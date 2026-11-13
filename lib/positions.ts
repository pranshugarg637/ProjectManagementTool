/**
 * Fractional ordering for lists and cards.
 *
 * Every list/card has a numeric `position`. The UI sorts by it.
 *  - Append to the end  → last position + 1000
 *  - Insert between two → the midpoint of the two neighbours
 *  - Insert at the top  → half of the first position
 * So a move only ever updates ONE row in the database.
 *
 * Midpoints halve the gap each time, so after ~40 inserts into the same spot
 * the gap gets tiny. When it drops below MIN_POSITION_GAP we "rebalance":
 * re-space the whole list to 1000, 2000, 3000… (same order, fresh gaps).
 */

export const POSITION_STEP = 1000;
export const MIN_POSITION_GAP = 1e-3;

export type Positioned = { position: number };

/** Sort a copy of the array by position (ascending). */
export function sortByPosition<T extends Positioned>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => a.position - b.position);
}

/** Position for something placed between `before` and `after` (either may be missing). */
export function positionBetween(before?: number | null, after?: number | null): number {
  const hasBefore = typeof before === "number";
  const hasAfter = typeof after === "number";

  if (!hasBefore && !hasAfter) return POSITION_STEP; // first item ever
  if (!hasBefore) return after! > 0 ? after! / 2 : after! - POSITION_STEP; // new first item
  if (!hasAfter) return before! + POSITION_STEP; // append
  return (before! + after!) / 2; // midpoint
}

/** Position for appending after the last item. */
export function appendPosition(items: readonly Positioned[]): number {
  if (items.length === 0) return POSITION_STEP;
  return Math.max(...items.map((i) => i.position)) + POSITION_STEP;
}

/**
 * Where should an item go if inserted at `index` among `siblings`?
 * `siblings` must be sorted and must NOT contain the item being moved.
 * Returns the new position and whether the list should be rebalanced.
 */
export function computeInsertPosition(
  siblings: readonly Positioned[],
  index: number,
): { position: number; rebalance: boolean } {
  const clamped = Math.max(0, Math.min(index, siblings.length));
  const before = siblings[clamped - 1]?.position;
  const after = siblings[clamped]?.position;
  const position = positionBetween(before, after);
  return { position, rebalance: needsRebalance(position, before, after) };
}

/** True when `position` is too close to a neighbour (or not a usable number). */
export function needsRebalance(position: number, before?: number, after?: number): boolean {
  if (!Number.isFinite(position)) return true;
  const gaps: number[] = [];
  if (typeof before === "number") gaps.push(Math.abs(position - before));
  if (typeof after === "number") gaps.push(Math.abs(after - position));
  // Inserting at the very top keeps halving towards 0, so watch that gap too.
  if (typeof before !== "number" && typeof after === "number") gaps.push(Math.abs(position));
  return gaps.some((gap) => gap < MIN_POSITION_GAP);
}

/** Re-space items to 1000, 2000, 3000… keeping their current order. */
export function rebalancePositions<T extends Positioned>(items: readonly T[]): T[] {
  return items.map((item, i) => ({ ...item, position: (i + 1) * POSITION_STEP }));
}
