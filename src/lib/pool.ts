/**
 * Runs an async map with a ceiling on how many tasks are in flight at once.
 *
 * `Promise.all(items.map(…))` is the obvious spelling and the wrong one for the Notion API:
 * an integration is allowed an average of about three requests per second, so a listing that
 * needs sixteen fresh image URLs would fire sixteen requests at once and be answered with
 * `429`s. A bounded pool keeps the same total work while staying inside the budget, and it
 * preserves input order in the result.
 *
 * The pool is deliberately minimal — no cancellation, no retry, no error collection. A
 * rejecting task rejects the whole map, which is what every caller here wants; the callers
 * that must not fail pass a task that never rejects.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  task: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new RangeError(`Concurrency limit must be a positive integer, got ${limit}`);
  }
  // Filled by index rather than pushed, so the result keeps the input order no matter
  // which worker finishes first.
  const results: R[] = [];
  let next = 0;

  const worker = async (): Promise<void> => {
    for (;;) {
      const index = next;
      next += 1;
      if (index >= items.length) return;
      results[index] = await task(items[index] as T, index);
    }
  };

  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
}
