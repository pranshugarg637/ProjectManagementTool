"use server";

import { friendlyDbError } from "@/lib/errors";
import {
  createListSchema,
  deleteListSchema,
  firstError,
  moveListSchema,
  renameListSchema,
} from "@/lib/validators";
import type { ActionResult } from "@/types/app";
import { fail, getAuthedClient, NO_PERMISSION, NOT_SIGNED_IN, ok } from "./helpers";

export async function createList(input: unknown): Promise<ActionResult> {
  const parsed = createListSchema.safeParse(input);
  if (!parsed.success) return fail(firstError(parsed.error));
  const { id, boardId, title, position } = parsed.data;

  const { supabase, user } = await getAuthedClient();
  if (!user) return fail(NOT_SIGNED_IN);

  const { error } = await supabase.from("lists").insert({ id, board_id: boardId, title, position });
  if (error) return fail(friendlyDbError(error, "Couldn't add the list"));
  return ok(undefined);
}

export async function renameList(input: unknown): Promise<ActionResult> {
  const parsed = renameListSchema.safeParse(input);
  if (!parsed.success) return fail(firstError(parsed.error));

  const { supabase, user } = await getAuthedClient();
  if (!user) return fail(NOT_SIGNED_IN);

  const { data, error } = await supabase
    .from("lists")
    .update({ title: parsed.data.title })
    .eq("id", parsed.data.listId)
    .select("id");
  if (error) return fail(friendlyDbError(error));
  if (!data?.length) return fail(NO_PERMISSION);
  return ok(undefined);
}

/** Save a list's new position after drag-and-drop (optionally re-space all lists). */
export async function moveList(input: unknown): Promise<ActionResult> {
  const parsed = moveListSchema.safeParse(input);
  if (!parsed.success) return fail(firstError(parsed.error));
  const { listId, boardId, position, rebalance } = parsed.data;

  const { supabase, user } = await getAuthedClient();
  if (!user) return fail(NOT_SIGNED_IN);

  const { data, error } = await supabase
    .from("lists")
    .update({ position })
    .eq("id", listId)
    .select("id");
  if (error) return fail(friendlyDbError(error));
  if (!data?.length) return fail(NO_PERMISSION);

  if (rebalance) {
    const { error: rpcError } = await supabase.rpc("rebalance_board_lists", {
      p_board_id: boardId,
    });
    if (rpcError) return fail(friendlyDbError(rpcError));
  }
  return ok(undefined);
}

export async function deleteList(input: unknown): Promise<ActionResult> {
  const parsed = deleteListSchema.safeParse(input);
  if (!parsed.success) return fail(firstError(parsed.error));

  const { supabase, user } = await getAuthedClient();
  if (!user) return fail(NOT_SIGNED_IN);

  const { data, error } = await supabase
    .from("lists")
    .delete()
    .eq("id", parsed.data.listId)
    .select("id");
  if (error) return fail(friendlyDbError(error));
  if (!data?.length) return fail(NO_PERMISSION);
  return ok(undefined);
}
