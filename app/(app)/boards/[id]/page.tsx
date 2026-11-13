import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { BoardView } from "@/components/board/board-view";
import { fetchBoardData } from "@/lib/board-data";
import { todayISO } from "@/lib/due-date";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata({ params }: PageProps<"/boards/[id]">): Promise<Metadata> {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return { title: "Board" };
  const supabase = await createClient();
  const { data } = await supabase.from("boards").select("title").eq("id", id).maybeSingle();
  return { title: data?.title ?? "Board" };
}

/**
 * Server Component: loads the board on the server (as the logged-in user, so RLS
 * applies) and hands it to the interactive client component <BoardView>.
 */
export default async function BoardPage({ params }: PageProps<"/boards/[id]">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect(`/login?next=/boards/${id}`);

  const data = await fetchBoardData(supabase, id, auth.user.id);
  if (!data) notFound(); // doesn't exist OR you're not a member (RLS hides it)

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col">
      <BoardView initialData={data} currentUserId={auth.user.id} serverToday={todayISO()} />
    </div>
  );
}
