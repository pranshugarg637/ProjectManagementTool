import { describe, expect, it } from "vitest";
import { buildBoardDigest, buildSummaryPrompt } from "@/lib/ai/board-digest";
import { findListIdOfCard, groupCards, moveCardBetweenLists } from "@/lib/board-state";
import { daysUntil, getDueStatus, todayISO } from "@/lib/due-date";
import { normalizeLabels } from "@/lib/labels";
import type { Card, List } from "@/types/app";

const list = (id: string, title: string, position: number): List => ({
  id,
  board_id: "b",
  title,
  position,
  created_at: "2026-01-01T00:00:00Z",
});
const card = (id: string, listId: string, position: number, extra: Partial<Card> = {}): Card => ({
  id,
  list_id: listId,
  board_id: "b",
  title: `Card ${id}`,
  description: null,
  position,
  due_date: null,
  labels: [],
  created_by: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  ...extra,
});

const lists = [list("todo", "To Do", 1000), list("done", "Done", 2000)];
const cards = [card("c2", "todo", 2000), card("c1", "todo", 1000), card("c3", "done", 1000)];

describe("board state helpers", () => {
  it("groups cards per list, sorted by position, including empty lists", () => {
    const grouped = groupCards([...lists, list("empty", "Empty", 3000)], cards);
    expect(grouped.todo.map((c) => c.id)).toEqual(["c1", "c2"]);
    expect(grouped.done.map((c) => c.id)).toEqual(["c3"]);
    expect(grouped.empty).toEqual([]);
  });

  it("moves a card between lists without mutating the input", () => {
    const grouped = groupCards(lists, cards);
    const moved = moveCardBetweenLists(grouped, "c1", "done", 0);
    expect(moved.todo.map((c) => c.id)).toEqual(["c2"]);
    expect(moved.done.map((c) => c.id)).toEqual(["c1", "c3"]);
    expect(moved.done[0].list_id).toBe("done");
    expect(grouped.todo).toHaveLength(2);
    expect(findListIdOfCard(moved, "c1")).toBe("done");
  });
});

describe("due dates", () => {
  it("computes day differences and status", () => {
    expect(daysUntil("2026-11-15", "2026-11-13")).toBe(2);
    expect(getDueStatus("2026-11-12", "2026-11-13")).toBe("overdue");
    expect(getDueStatus("2026-11-13", "2026-11-13")).toBe("today");
    expect(getDueStatus("2026-11-16", "2026-11-13")).toBe("soon");
    expect(getDueStatus("2026-12-30", "2026-11-13")).toBe("later");
    expect(getDueStatus(null, "2026-11-13")).toBeNull();
  });
  it("formats today as YYYY-MM-DD", () => {
    expect(todayISO(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("labels", () => {
  it("normalises, de-duplicates and caps labels", () => {
    expect(normalizeLabels([" Bug ", "bug", "", "Design"])).toEqual(["bug", "design"]);
    expect(normalizeLabels(Array.from({ length: 15 }, (_, i) => `l${i}`))).toHaveLength(10);
  });
});

describe("AI digest", () => {
  it("lists every column in order and flags overdue cards", () => {
    const digest = buildBoardDigest({
      title: "Launch",
      description: "Ship it",
      lists,
      cards: [...cards, card("c4", "todo", 3000, { due_date: "2026-11-10", labels: ["blocked"] })],
      today: "2026-11-13",
    });
    expect(digest.indexOf("## To Do")).toBeLessThan(digest.indexOf("## Done"));
    expect(digest).toContain("OVERDUE by 3d");
    expect(digest).toContain("{blocked}");
    expect(digest).toContain("Total cards: 4");
  });

  it("wraps the board as data inside the prompt", () => {
    const prompt = buildSummaryPrompt("Board: X");
    expect(prompt).toContain("<board>\nBoard: X\n</board>");
    expect(prompt).toContain("Suggested next actions");
  });
});
