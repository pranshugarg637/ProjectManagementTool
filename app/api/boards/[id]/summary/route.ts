import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { buildBoardDigest, buildSummaryPrompt } from "@/lib/ai/board-digest";
import { GeminiError, generateWithGemini, isGeminiConfigured } from "@/lib/ai/gemini";
import { fetchBoardData } from "@/lib/board-data";
import { todayISO } from "@/lib/due-date";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/boards/:id/summary → { summary: string } (Markdown)
 *
 * 1. must be signed in                       → else 401
 * 2. must be a member of the board (any role) → else 404 (RLS hides the board)
 * 3. friendly message if GEMINI_API_KEY isn't set
 * 4. rate limit: 1 request per board per 30s (enforced in Postgres) → else 429
 * 5. compact text version of the board → Gemini → Markdown back to the browser
 */
export async function POST(_request: NextRequest, ctx: RouteContext<"/api/boards/[id]/summary">) {
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Invalid board id." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const board = await fetchBoardData(supabase, id, auth.user.id).catch(() => null);
  if (!board) {
    return NextResponse.json(
      { error: "Board not found or you don't have access." },
      { status: 404 },
    );
  }

  if (!isGeminiConfigured()) {
    return NextResponse.json({
      summary:
        "**AI summary isn't set up yet.**\n\nAdd a free `GEMINI_API_KEY` from Google AI Studio to the environment variables (see the README), redeploy, and try again.",
    });
  }

  const { data: wait, error: rateError } = await supabase.rpc("claim_ai_summary_slot", {
    p_board_id: id,
  });
  if (rateError) {
    return NextResponse.json({ error: "Couldn't check the rate limit." }, { status: 500 });
  }
  if (wait > 0) {
    return NextResponse.json(
      {
        error: `Please wait ${wait}s before generating another summary for this board.`,
        retryAfter: wait,
      },
      { status: 429, headers: { "Retry-After": String(wait) } },
    );
  }

  const digest = buildBoardDigest({
    title: board.board.title,
    description: board.board.description,
    lists: board.lists,
    cards: board.cards,
    today: todayISO(),
  });

  try {
    const summary = await generateWithGemini(buildSummaryPrompt(digest));
    return NextResponse.json({ summary });
  } catch (error) {
    const message = error instanceof GeminiError ? error.message : "The AI service didn't respond.";
    console.error("[ai-summary]", error);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
