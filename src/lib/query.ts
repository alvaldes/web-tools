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
 * Keeps the tools that match both the tag selection and the text query.
 *
 * A tool matches the tag selection when it carries **any** of the selected tag ids.
 * That preserves the current server behaviour, where the Notion filter built an `or`
 * over the selected tags rather than an `and`, so switching the pipeline to the client
 * does not quietly change what the chips mean.
 */
export function filterTools(
  tools: WebTools[],
  selectedTagIds: string[],
  query: string,
  tagsById: Map<string, Tags>,
): WebTools[] {
  const needle = normalize(query);
  return tools.filter((tool) => {
    if (
      selectedTagIds.length > 0 &&
      !tool.tags.some((tagId) => selectedTagIds.includes(tagId))
    ) {
      return false;
    }
    if (needle === "") return true;
    const fields = [
      tool.title,
      tool.url,
      ...tool.tags.map((tagId) => tagsById.get(tagId)?.name ?? ""),
    ];
    return fields.some((field) => normalize(field).includes(needle));
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

/** Returns a new array ordered by title, leaving the input untouched. */
export function sortTools(
  tools: WebTools[],
  direction: SortDirection,
): WebTools[] {
  const sign = direction === "asc" ? 1 : -1;
  return [...tools].sort(
    (a, b) => sign * nameCollator.compare(a.title, b.title),
  );
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
