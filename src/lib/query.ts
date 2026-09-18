/**
 * The single place where the searcher's behaviour is decided.
 *
 * Every rule the toolbar applies -- what "matches" means, which fields are searched,
 * how tag selections combine, how titles are ordered -- lives here as a pure function.
 * The island only composes these, so the behaviour can be reasoned about (and changed)
 * without reading component state, and no rule is duplicated between the data layer
 * and the client.
 */
import type { Tags, WebTools } from "./notion";
// Type-only, so no runtime edge is created between the two modules: `utils.ts` must not
// start importing this file back, or the cycle would be real.
import type { TagCategory } from "./utils";

export type SortDirection = "asc" | "desc";

/**
 * Folds case, accents and surrounding whitespace so `cafe` matches `Café`.
 *
 * NFD splits `é` into `e` plus a combining accent, and the `\p{Diacritic}` class then
 * removes it. Notion's `rich_text.contains` was exact about diacritics, which is wrong
 * for a Spanish-facing listing: `cafe` and `café` are the same intent.
 */
export function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

/**
 * Fuzzy match score inspired by fzf.
 *
 * Returns a score > 0 when the needle fuzzy-matches the haystack, or -1 when it
 * doesn't. Scoring rules:
 *   - Consecutive matches get a bonus (3 pts each)
 *   - Match at the start of a word gets a bonus (5 pts)
 *   - Exact case match gets a small bonus (1 pt)
 *   - Each matched character gets 1 pt base
 *
 * The needle chars must appear in order in the haystack, but not necessarily
 * consecutively. "svr" matches "SVG Repo" (S..V..R).
 */
export function fuzzyScore(needle: string, haystack: string): number {
  if (needle.length === 0) return 0;
  if (needle.length > haystack.length) return -1;

  const nLen = needle.length;
  const hLen = haystack.length;
  let nIdx = 0;
  let hIdx = 0;
  let score = 0;
  let prevMatched = false;

  while (nIdx < nLen && hIdx < hLen) {
    if (needle[nIdx] === haystack[hIdx]) {
      score += 1; // base point per match

      // Consecutive match bonus
      if (prevMatched) score += 3;

      // Start-of-word bonus (after space, hyphen, or at start)
      if (hIdx === 0 || haystack[hIdx - 1] === " " || haystack[hIdx - 1] === "-") {
        score += 5;
      }

      // Exact case match bonus
      if (needle[nIdx] === haystack[hIdx]) score += 1;

      prevMatched = true;
      nIdx++;
    } else {
      prevMatched = false;
    }
    hIdx++;
  }

  // All needle chars found?
  return nIdx === nLen ? score : -1;
}

/**
 * Normalized version of fuzzyScore for accent-insensitive matching.
 */
export function fuzzyMatch(query: string, text: string): number {
  return fuzzyScore(normalize(query), normalize(text));
}

/**
 * Keeps the tools that match both the tag selection and the text query.
 *
 * A tool matches the tag selection when it carries **any** of the selected tag ids.
 * That preserves the current server behaviour, where the Notion filter built an `or`
 * over the selected tags rather than an `and`, so switching the pipeline to the client
 * does not quietly change what the chips mean.
 *
 * When the query is non-empty, every tool gets a fuzzy score against title, URL,
 * and tag names. Only tools with a score > 0 pass. The caller sorts by score
 * to get fzf-like relevance ordering.
 */
export function filterTools(
  tools: WebTools[],
  selectedTagIds: string[],
  query: string,
  tagsById: Map<string, Tags>,
): WebTools[] {
  const needle = query.trim();
  return tools.filter((tool) => {
    if (
      selectedTagIds.length > 0 &&
      !tool.tags.some((tagId) => selectedTagIds.includes(tagId))
    ) {
      return false;
    }
    if (needle === "") return true;
    const tagNames = tool.tags.map((tagId) => tagsById.get(tagId)?.name ?? "");
    return fuzzyMatch(needle, tool.title) > 0 ||
      fuzzyMatch(needle, tool.url) > 0 ||
      tagNames.some((name) => fuzzyMatch(needle, name) > 0);
  });
}

// `sensitivity: "base"` makes the order accent- and case-insensitive, which is what
// this listing wants: "Éditeur" and "editeur" are the same entry to the reader.
// Built once at module scope and shared by every name comparison (tool titles and tag
// names); a collator per call would be pure overhead.
const nameCollator = new Intl.Collator("es", {
  sensitivity: "base",
  numeric: true,
});

/**
 * Sort by title (alphabetical), leaving the input untouched.
 */
export function sortTools(
  tools: WebTools[],
  direction: SortDirection,
): WebTools[] {
  const sign = direction === "asc" ? 1 : -1;
  return [...tools].sort(
    (a, b) => sign * nameCollator.compare(a.title, b.title),
  );
}

/**
 * Sort by fuzzy relevance score (descending), then title as tiebreaker.
 * Used when a search query is active.
 */
export function sortByRelevance(
  tools: WebTools[],
  query: string,
  tagsById: Map<string, Tags>,
): WebTools[] {
  if (!query.trim()) return tools;
  return [...tools].sort((a, b) => {
    const tagNamesA = a.tags.map((id) => tagsById.get(id)?.name ?? "");
    const tagNamesB = b.tags.map((id) => tagsById.get(id)?.name ?? "");

    const scoreA = Math.max(
      fuzzyMatch(query, a.title),
      fuzzyMatch(query, a.url),
      ...tagNamesA.map((n) => fuzzyMatch(query, n)),
    );
    const scoreB = Math.max(
      fuzzyMatch(query, b.title),
      fuzzyMatch(query, b.url),
      ...tagNamesB.map((n) => fuzzyMatch(query, n)),
    );

    if (scoreB !== scoreA) return scoreB - scoreA;
    return nameCollator.compare(a.title, b.title);
  });
}

/** One selectable row of the filter panel. */
export interface TagGroupOption {
  tag: Tags;
  count: number;
}

/** One titled block of the filter panel. */
export interface TagGroup {
  name: string;
  options: TagGroupOption[];
}

/**
 * Counts how many tools carry each tag id.
 *
 * The unit is tools, not relation edges, so a row that somehow repeats a relation
 * still counts once. Rows whose tags are unknown ids are counted as they are; the
 * caller only ever looks up the ids it has a tag for.
 */
export function countToolsByTag(tools: WebTools[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const tool of tools) {
    for (const tagId of new Set(tool.tags)) {
      counts.set(tagId, (counts.get(tagId) ?? 0) + 1);
    }
  }
  return counts;
}

/**
 * Turns the tag catalog plus its counts into the grouped rows of the filter panel.
 *
 * Three rules make the panel follow the data instead of a hardcoded whitelist:
 * a tag nobody uses is dropped, an empty group is dropped, and every tag that no
 * category names still lands in a final `otherLabel` group. That last rule is what
 * closes the whitelist defect: a tag added in Notion without touching `tagCategories`
 * is filterable the moment some tool carries it.
 *
 * Neither `tags` nor `categories` is mutated; every array built here is new.
 */
export function groupTagsByCategory(
  tags: Tags[],
  counts: Map<string, number>,
  categories: TagCategory[],
  otherLabel: string,
): TagGroup[] {
  const inUse = tags.filter((tag) => (counts.get(tag.id) ?? 0) > 0);
  const namedByCategory = new Set(
    categories.flatMap((category) => category.tags),
  );
  const toOption = (tag: Tags): TagGroupOption => ({
    tag,
    count: counts.get(tag.id) ?? 0,
  });
  const byName = (a: TagGroupOption, b: TagGroupOption) =>
    nameCollator.compare(a.tag.name, b.tag.name);

  // `categories` order is kept as authored, so the panel reads the same way on every
  // render and the Spanish taxonomy stays under editorial control.
  const groups: TagGroup[] = categories.map((category) => ({
    name: category.name,
    options: inUse
      // Category membership is authored in lowercase (`src/lib/utils.ts`); tag names
      // come from Notion, so the comparison folds case either way.
      .filter((tag) => category.tags.includes(tag.name.toLowerCase()))
      .map(toOption)
      .sort(byName),
  }));

  const others = inUse
    .filter((tag) => !namedByCategory.has(tag.name.toLowerCase()))
    .map(toOption)
    .sort(byName);
  // Only when non-empty: with every tag named by a category this group would render as
  // a bare heading with no rows under it.
  if (others.length > 0) {
    groups.push({ name: otherLabel, options: others });
  }

  return groups.filter((group) => group.options.length > 0);
}
