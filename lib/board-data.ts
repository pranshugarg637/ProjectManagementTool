/**
 * Data loading shared by the server (first page render) and the browser
 * (refetch after a Realtime event). Works with either Supabase client, and
 * because both run as the logged-in user, RLS decides what comes back.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { isRole } from "@/lib/permissions";
import type { BoardData, BoardSummary, Member } from "@/types/app";
import type { Database } from "@/types/database";

type Client = SupabaseClient<Database>;

/** Load one board with its lists, cards and members. Null = not found / no access. */
export async function fetchBoardData(
  supabase: Client,
  boardId: string,
  userId: string,
): Promise<BoardData | null> {
  const [boardRes, listsRes, cardsRes, membersRes] = await Promise.all([
    supabase.from("boards").select("*").eq("id", boardId).maybeSingle(),
    supabase.from("lists").select("*").eq("board_id", boardId).order("position"),
    supabase.from("cards").select("*").eq("board_id", boardId).order("position"),
    supabase
      .from("board_members")
      .select("user_id, role, created_at, profiles(email, full_name)")
      .eq("board_id", boardId)
      .order("created_at"),
  ]);

  const error = boardRes.error ?? listsRes.error ?? cardsRes.error ?? membersRes.error;
  if (error) throw new Error(error.message);
  if (!boardRes.data) return null; // RLS hides boards you're not a member of

  const members: Member[] = (membersRes.data ?? [])
    .filter((m) => isRole(m.role))
    .map((m) => ({
      user_id: m.user_id,
      role: m.role as Member["role"],
      created_at: m.created_at,
      email: m.profiles?.email ?? "unknown",
      full_name: m.profiles?.full_name ?? null,
    }));

  const me = members.find((m) => m.user_id === userId);
  if (!me) return null;

  return {
    board: boardRes.data,
    lists: listsRes.data ?? [],
    cards: cardsRes.data ?? [],
    members,
    role: me.role,
  };
}

/** Boards the user belongs to, newest first, with their role and simple counts. */
export async function fetchMyBoards(supabase: Client, userId: string): Promise<BoardSummary[]> {
  const { data, error } = await supabase
    .from("board_members")
    .select("role, boards(*, lists(count), cards(count))")
    .eq("user_id", userId);

  if (error) throw new Error(error.message);

  return (data ?? [])
    .filter((row) => row.boards && isRole(row.role))
    .map((row) => {
      const { lists, cards, ...board } = row.boards!;
      return {
        ...board,
        role: row.role as BoardSummary["role"],
        listCount: lists?.[0]?.count ?? 0,
        cardCount: cards?.[0]?.count ?? 0,
      };
    })
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}
