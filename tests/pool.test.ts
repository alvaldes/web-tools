// Run by `bun test`. See tests/notionRows.test.ts for why the import is ignored rather than
// expected to fail.
// @ts-ignore -- "bun:test" has no type declarations without bun-types.
import { describe, expect, test } from "bun:test";
import { mapWithConcurrency } from "@/lib/pool";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("mapWithConcurrency", () => {
  test("returns the results in input order even when tasks finish out of order", async () => {
    const items = [40, 5, 20, 1];
    const results = await mapWithConcurrency(items, 2, async (item) => {
      await sleep(item);
      return item;
    });
    expect(results).toEqual(items);
  });

  test("never runs more tasks at once than the limit", async () => {
    let inFlight = 0;
    let peak = 0;
    const results = await mapWithConcurrency([1, 2, 3, 4, 5, 6, 7], 3, async (item) => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await sleep(2);
      inFlight -= 1;
      return item * 2;
    });
    expect(peak).toBe(3);
    expect(results).toEqual([2, 4, 6, 8, 10, 12, 14]);
  });

  test("passes the index of each item", async () => {
    const seen = await mapWithConcurrency(["a", "b", "c"], 2, async (item, index) => `${index}:${item}`);
    expect(seen).toEqual(["0:a", "1:b", "2:c"]);
  });

  test("answers an empty array without calling the task", async () => {
    let calls = 0;
    const results = await mapWithConcurrency([], 3, async () => {
      calls += 1;
      return 1;
    });
    expect(results).toEqual([]);
    expect(calls).toBe(0);
  });

  test("rejects when a task rejects", async () => {
    const failure = new Error("boom");
    expect(
      mapWithConcurrency([1, 2], 2, async (item) => {
        if (item === 2) throw failure;
        return item;
      }),
    ).rejects.toBe(failure);
  });

  test("refuses a limit that cannot bound anything", async () => {
    expect(mapWithConcurrency([1], 0, async (item) => item)).rejects.toBeInstanceOf(RangeError);
    expect(mapWithConcurrency([1], 1.5, async (item) => item)).rejects.toBeInstanceOf(RangeError);
  });
});
