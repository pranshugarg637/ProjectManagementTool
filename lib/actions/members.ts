"use server";

import { friendlyDbError } from "@/lib/errors";
import {
  boardIdSchema,
  changeRoleSchema,
  firstError,
  inviteMemberSchema,
  removeMemberSchema,
} from "@/lib/validators";
import type { ActionResult } from "@/types/app";
import { fail, getAuthedClient, NO_PERMISSION, NOT_SIGNED_IN, ok } from "./helpers";

/** Invite an existing user by email. The invite_member SQL function does the checks. */
export async function inviteMember(input: unknown): Promise<ActionResult> {
  const parsed = inviteMemberSchema.safeParse(input);
  if (!parsed.success) return fail(firstError(parsed.error));

  const { supabase, user } = await getAuthedClient();
  if (!user) return fail(NOT_SIGNED_IN);

  const { error } = await supabase.rpc("invite_member", {
    p_board_id: parsed.data.boardId,
    p_email: parsed.data.email,
    p_role: parsed.data.role,
  });
  if (error) return fail(friendlyDbError(error, "Couldn't invite that person"));
  return ok(undefined);
}

export async function changeMemberRole(input: unknown): Promise<ActionResult> {
  const parsed = changeRoleSchema.safeParse(input);
  if (!parsed.success) return fail(firstError(parsed.error));
  const { boardId, userId, role } = parsed.data;

  const { supabase, user } = await getAuthedClient();
  if (!user) return fail(NOT_SIGNED_IN);

  const { data, error } = await supabase
    .from("board_members")
    .update({ role })
    .eq("board_id", boardId)
    .eq("user_id", userId)
    .select("user_id");
  if (error) return fail(friendlyDbError(error)); // includes "must keep at least one owner"
  if (!data?.length) return fail(NO_PERMISSION);
  return ok(undefined);
}

export async function removeMember(input: unknown): Promise<ActionResult> {
  const parsed = removeMemberSchema.safeParse(input);
  if (!parsed.success) return fail(firstError(parsed.error));
  const { boardId, userId } = parsed.data;

  const { supabase, user } = await getAuthedClient();
  if (!user) return fail(NOT_SIGNED_IN);

  const { data, error } = await supabase
    .from("board_members")
    .delete()
    .eq("board_id", boardId)
    .eq("user_id", userId)
    .select("user_id");
  if (error) return fail(friendlyDbError(error));
  if (!data?.length) return fail(NO_PERMISSION);
  return ok(undefined);
}

/** Any member can leave a board (unless they are its last owner). */
export async function leaveBoard(input: unknown): Promise<ActionResult> {
  const parsed = boardIdSchema.safeParse(input);
  if (!parsed.success) return fail(firstError(parsed.error));

  const { supabase, user } = await getAuthedClient();
  if (!user) return fail(NOT_SIGNED_IN);

  const { data, error } = await supabase
    .from("board_members")
    .delete()
    .eq("board_id", parsed.data.boardId)
    .eq("user_id", user.id)
    .select("user_id");
  if (error) return fail(friendlyDbError(error));
  if (!data?.length) return fail(NO_PERMISSION);
  return ok(undefined);
}
