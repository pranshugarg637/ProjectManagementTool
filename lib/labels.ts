import { hashString } from "@/lib/utils";

/** Suggested labels shown in the card editor (users can also type their own). */
export const SUGGESTED_LABELS = [
  "bug",
  "feature",
  "design",
  "frontend",
  "backend",
  "content",
  "marketing",
  "research",
  "urgent",
  "blocked",
] as const;

const FIXED: Record<string, string> = {
  bug: "bg-red-500/15 text-red-700 dark:text-red-300",
  urgent: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
  blocked: "bg-zinc-500/20 text-zinc-700 dark:text-zinc-300",
  feature: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  design: "bg-pink-500/15 text-pink-700 dark:text-pink-300",
};

const PALETTE = [
  "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  "bg-amber-500/15 text-amber-800 dark:text-amber-300",
  "bg-teal-500/15 text-teal-700 dark:text-teal-300",
  "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
  "bg-lime-500/15 text-lime-800 dark:text-lime-300",
];

/** Consistent colour classes for a label name. */
export function labelClasses(label: string): string {
  const key = label.toLowerCase();
  return FIXED[key] ?? PALETTE[hashString(key) % PALETTE.length];
}

/** Trim, lowercase, de-duplicate, cap at 10 labels. */
export function normalizeLabels(labels: readonly string[]): string[] {
  const seen = new Set<string>();
  for (const raw of labels) {
    const label = raw.trim().toLowerCase().slice(0, 24);
    if (label) seen.add(label);
  }
  return [...seen].slice(0, 10);
}
