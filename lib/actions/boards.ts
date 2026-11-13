"use server";

import { revalidatePath } from "next/cache";
import { friendlyDbError } from "@/lib/errors";
import { newId } from "@/lib/utils";
import { boardIdSchema, createBoardSchema, firstError, updateBoardSchema } from "@/lib/validators";
import type { ActionResult } from "@/types/app";
import { fail, getAuthedClient, NO_PERMISSION, NOT_SIGNED_IN, ok } from "./helpers";

export async function createBoard(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = createBoardSchema.safeParse(input);
  if (!parsed.success) return fail(firstError(parsed.error));

  const { supabase, user } = await getAuthedClient();
  if (!user) return fail(NOT_SIGNED_IN);

  // We generate the id here and insert WITHOUT `.select()`: Postgres checks the
  // SELECT policy for RETURNING before the "add creator as owner" trigger runs,
  // so asking for the row back would be rejected.
  const id = newId();
  const { error } = await supabase.from("boards").insert({
    id,
    title: parsed.data.title,
    description: parsed.data.description || null,
    owner_id: user.id,
  });
  if (error) return fail(friendlyDbError(error, "Couldn't create the board"));

  revalidatePath("/boards");
  return ok({ id });
}

export async function updateBoard(input: unknown): Promise<ActionResult> {
  const parsed = updateBoardSchema.safeParse(input);
  if (!parsed.success) return fail(firstError(parsed.error));
  const { boardId, ...changes } = parsed.data;

  const { supabase, user } = await getAuthedClient();
  if (!user) return fail(NOT_SIGNED_IN);

  const { data, error } = await supabase
    .from("boards")
    .update(changes)
    .eq("id", boardId)
    .select("id");
  if (error) return fail(friendlyDbError(error));
  if (!data?.length) return fail(NO_PERMISSION); // RLS silently filtered the row

  revalidatePath("/boards");
  return ok(undefined);
}

export async function deleteBoard(input: unknown): Promise<ActionResult> {
  const parsed = boardIdSchema.safeParse(input);
  if (!parsed.success) return fail(firstError(parsed.error));

  const { supabase, user } = await getAuthedClient();
  if (!user) return fail(NOT_SIGNED_IN);

  const { data, error } = await supabase
    .from("boards")
    .delete()
    .eq("id", parsed.data.boardId)
    .select("id");
  if (error) return fail(friendlyDbError(error));
  if (!data?.length) return fail("Only owners can delete a board.");

  revalidatePath("/boards");
  return ok(undefined);
}
