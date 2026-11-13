import { describe, expect, it } from "vitest";
import {
  appendPosition,
  computeInsertPosition,
  MIN_POSITION_GAP,
  needsRebalance,
  POSITION_STEP,
  positionBetween,
  rebalancePositions,
  sortByPosition,
} from "@/lib/positions";

const items = (...positions: number[]) =>
  positions.map((position, i) => ({ id: `i${i}`, position }));

describe("positionBetween", () => {
  it("gives the first item 1000", () => {
    expect(positionBetween()).toBe(POSITION_STEP);
  });
  it("appends at last + 1000", () => {
    expect(positionBetween(3000, undefined)).toBe(4000);
  });
  it("uses the midpoint between two neighbours", () => {
    expect(positionBetween(1000, 2000)).toBe(1500);
    expect(positionBetween(1000, 1001)).toBe(1000.5);
  });
  it("halves the first position when inserting at the top", () => {
    expect(positionBetween(undefined, 1000)).toBe(500);
  });
  it("still works at the top when positions are zero or negative", () => {
    expect(positionBetween(undefined, 0)).toBe(-1000);
    expect(positionBetween(undefined, -50)).toBeLessThan(-50);
  });
});

describe("appendPosition", () => {
  it("returns 1000 for an empty list", () => {
    expect(appendPosition([])).toBe(1000);
  });
  it("returns max + 1000 even if unsorted", () => {
    expect(appendPosition(items(3000, 1000, 2000))).toBe(4000);
  });
});

describe("computeInsertPosition", () => {
  const siblings = items(1000, 2000, 3000);

  it("inserts at the start, middle and end", () => {
    expect(computeInsertPosition(siblings, 0).position).toBe(500);
    expect(computeInsertPosition(siblings, 1).position).toBe(1500);
    expect(computeInsertPosition(siblings, 3).position).toBe(4000);
  });

  it("clamps out-of-range indexes", () => {
    expect(computeInsertPosition(siblings, -5).position).toBe(500);
    expect(computeInsertPosition(siblings, 99).position).toBe(4000);
  });

  it("keeps order: new position is strictly between neighbours", () => {
    const { position } = computeInsertPosition(siblings, 2);
    expect(position).toBeGreaterThan(2000);
    expect(position).toBeLessThan(3000);
  });

  it("does not ask for a rebalance with healthy gaps", () => {
    expect(computeInsertPosition(siblings, 1).rebalance).toBe(false);
  });

  it("asks for a rebalance after many inserts into the same gap", () => {
    // Keep inserting right after the first item until the gap collapses.
    let list = items(1000, 2000);
    let flagged = false;
    for (let i = 0; i < 60 && !flagged; i++) {
      const result = computeInsertPosition(list, 1);
      flagged = result.rebalance;
      list = sortByPosition([...list, { id: `n${i}`, position: result.position }]);
    }
    expect(flagged).toBe(true);
  });

  it("works for an empty list", () => {
    expect(computeInsertPosition([], 0)).toEqual({ position: 1000, rebalance: false });
  });
});

describe("needsRebalance", () => {
  it("flags gaps smaller than MIN_POSITION_GAP", () => {
    expect(needsRebalance(1000 + MIN_POSITION_GAP / 2, 1000, 1001)).toBe(true);
  });
  it("flags duplicates and non-finite numbers", () => {
    expect(needsRebalance(1000, 1000, 2000)).toBe(true);
    expect(needsRebalance(Number.NaN, 1, 2)).toBe(true);
  });
  it("flags positions that shrink towards zero at the top", () => {
    expect(needsRebalance(0.0001, undefined, 0.0002)).toBe(true);
  });
  it("is fine for normal gaps", () => {
    expect(needsRebalance(1500, 1000, 2000)).toBe(false);
  });
});

describe("rebalancePositions", () => {
  it("re-spaces items to 1000, 2000, 3000 keeping the order", () => {
    const result = rebalancePositions(items(1, 1.0001, 1.0002));
    expect(result.map((i) => i.position)).toEqual([1000, 2000, 3000]);
    expect(result.map((i) => i.id)).toEqual(["i0", "i1", "i2"]);
  });
  it("does not mutate the input", () => {
    const input = items(5, 6);
    rebalancePositions(input);
    expect(input[0].position).toBe(5);
  });
});

describe("sortByPosition", () => {
  it("sorts ascending without mutating", () => {
    const input = items(3, 1, 2);
    expect(sortByPosition(input).map((i) => i.position)).toEqual([1, 2, 3]);
    expect(input[0].position).toBe(3);
  });
});
