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
// Built once at module scope; a collator per call would be pure overhead.
const titleCollator = new Intl.Collator("es", {
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
    (a, b) => sign * titleCollator.compare(a.title, b.title),
  );
}
