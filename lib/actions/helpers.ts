import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/types/app";

/**
 * Every Server Action starts here: get a Supabase client bound to the current
 * user's cookies and make sure someone is signed in.
 */
export async function getAuthedClient() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return { supabase, user: data.user };
}

export const ok = <T>(data: T): ActionResult<T> => ({ ok: true, data });
export const fail = <T = never>(error: string): ActionResult<T> => ({ ok: false, error });

export const NOT_SIGNED_IN = "Your session expired. Please sign in again.";
export const NO_PERMISSION = "You don't have permission to do that.";
