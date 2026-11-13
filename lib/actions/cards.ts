"use server";

import { friendlyDbError } from "@/lib/errors";
import { normalizeLabels } from "@/lib/labels";
import {
  createCardSchema,
  deleteCardSchema,
  firstError,
  moveCardSchema,
  updateCardSchema,
} from "@/lib/validators";
import type { ActionResult } from "@/types/app";
import type { TablesUpdate } from "@/types/database";
import { fail, getAuthedClient, NO_PERMISSION, NOT_SIGNED_IN, ok } from "./helpers";

export async function createCard(input: unknown): Promise<ActionResult> {
  const parsed = createCardSchema.safeParse(input);
  if (!parsed.success) return fail(firstError(parsed.error));
  const { id, listId, boardId, title, position } = parsed.data;

  const { supabase, user } = await getAuthedClient();
  if (!user) return fail(NOT_SIGNED_IN);

  const { error } = await supabase.from("cards").insert({
    id,
    list_id: listId,
    // Not trusted: the cards_before_write trigger re-copies board_id from the list.
    board_id: boardId,
    title,
    position,
  });
  if (error) return fail(friendlyDbError(error, "Couldn't add the card"));
  return ok(undefined);
}

export async function updateCard(input: unknown): Promise<ActionResult> {
  const parsed = updateCardSchema.safeParse(input);
  if (!parsed.success) return fail(firstError(parsed.error));
  const { cardId, title, description, dueDate, labels } = parsed.data;

  const changes: TablesUpdate<"cards"> = {};
  if (title !== undefined) changes.title = title;
  if (description !== undefined) changes.description = description?.trim() || null;
  if (dueDate !== undefined) changes.due_date = dueDate;
  if (labels !== undefined) changes.labels = normalizeLabels(labels);

  const { supabase, user } = await getAuthedClient();
  if (!user) return fail(NOT_SIGNED_IN);

  const { data, error } = await supabase
    .from("cards")
    .update(changes)
    .eq("id", cardId)
    .select("id");
  if (error) return fail(friendlyDbError(error));
  if (!data?.length) return fail(NO_PERMISSION);
  return ok(undefined);
}

/**
 * Save a card's new list + position after drag-and-drop.
 * Only ONE row changes thanks to fractional positions. If the gap got too small
 * we also ask Postgres to re-space the whole list (rebalance_list_cards).
 */
export async function moveCard(input: unknown): Promise<ActionResult> {
  const parsed = moveCardSchema.safeParse(input);
  if (!parsed.success) return fail(firstError(parsed.error));
  const { cardId, toListId, position, rebalance } = parsed.data;

  const { supabase, user } = await getAuthedClient();
  if (!user) return fail(NOT_SIGNED_IN);

  const { data, error } = await supabase
    .from("cards")
    .update({ list_id: toListId, position })
    .eq("id", cardId)
    .select("id");
  if (error) return fail(friendlyDbError(error));
  if (!data?.length) return fail(NO_PERMISSION);

  if (rebalance) {
    const { error: rpcError } = await supabase.rpc("rebalance_list_cards", { p_list_id: toListId });
    if (rpcError) return fail(friendlyDbError(rpcError));
  }
  return ok(undefined);
}

export async function deleteCard(input: unknown): Promise<ActionResult> {
  const parsed = deleteCardSchema.safeParse(input);
  if (!parsed.success) return fail(firstError(parsed.error));

  const { supabase, user } = await getAuthedClient();
  if (!user) return fail(NOT_SIGNED_IN);

  const { data, error } = await supabase
    .from("cards")
    .delete()
    .eq("id", parsed.data.cardId)
    .select("id");
  if (error) return fail(friendlyDbError(error));
  if (!data?.length) return fail(NO_PERMISSION);
  return ok(undefined);
}
