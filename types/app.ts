/** App-level types built on top of the generated database types. */
import type { Tables } from "@/types/database";
import type { Role } from "@/lib/permissions";

export type Profile = Tables<"profiles">;
export type Board = Tables<"boards">;
export type List = Tables<"lists">;
export type Card = Tables<"cards">;
export type ActivityEntry = Tables<"activity_log">;

/** A board member joined with their profile (for avatars and the Share dialog). */
export type Member = {
  user_id: string;
  role: Role;
  created_at: string;
  email: string;
  full_name: string | null;
};

/** Board summary shown on the /boards grid. */
export type BoardSummary = Board & { role: Role; listCount: number; cardCount: number };

/** Everything the board page needs. */
export type BoardData = {
  board: Board;
  lists: List[];
  cards: Card[];
  members: Member[];
  /** The current user's role on this board. */
  role: Role;
};

/** Standard return shape for every Server Action (errors are returned, not thrown). */
export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };
