/** Helpers for card due dates. Dates are plain "YYYY-MM-DD" strings (no timezone). */

export type DueStatus = "overdue" | "today" | "soon" | "later";

/** Today's date as YYYY-MM-DD in the user's local timezone. */
export function todayISO(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Whole days from `today` to `due` (negative = in the past). */
export function daysUntil(due: string, today: string): number {
  const toUTC = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUTC(due) - toUTC(today)) / 86_400_000);
}

export function getDueStatus(due: string | null | undefined, today: string): DueStatus | null {
  if (!due) return null;
  const days = daysUntil(due, today);
  if (days < 0) return "overdue";
  if (days === 0) return "today";
  if (days <= 3) return "soon";
  return "later";
}

/** "12 Nov" style label (year added when it isn't this year). */
export function formatDueDate(due: string, today: string): string {
  const [y, m, d] = due.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const sameYear = today.slice(0, 4) === due.slice(0, 4);
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
    timeZone: "UTC",
  });
}
