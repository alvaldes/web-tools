/**
 * The searcher state that a URL can carry.
 *
 * Pure and DOM-free on purpose: the island owns every `history` and `window.location`
 * call, so this module only translates between a query string and a plain object. That
 * keeps the rules -- what a link may say, what it may not -- testable without a browser,
 * and keeps a stale link from filtering against a tag the catalog no longer knows.
 */
import type { SortDirection } from "./query";

export interface SearchState {
  query: string;
  tagIds: string[];
  sort: SortDirection;
}

export const defaultSearchState: SearchState = {
  query: "",
  tagIds: [],
  sort: "asc",
};

/**
 * Reads a raw query string -- with or without the leading `?` -- into a `SearchState`.
 *
 * Never throws, and every value it cannot read is replaced by the default rather than
 * trusted: an unknown `sort` falls back to the default order, and a tag id that
 * `knownTagIds` does not contain is dropped. That last rule is why the catalog is a
 * required argument: a stale or hand-edited link must not silently filter the listing
 * against a tag that no longer exists, which would render an empty page with an
 * unremovable chip.
 */
export function parseSearchState(
  search: string,
  knownTagIds: ReadonlySet<string>,
): SearchState {
  const params = new URLSearchParams(
    search.startsWith("?") ? search.slice(1) : search,
  );
  const sort = params.get("sort");
  return {
    query: params.get("q") ?? defaultSearchState.query,
    tagIds: (params.get("tags") ?? "")
      .split(",")
      // The empty string is what an absent or bare `tags=` splits into, so it is
      // filtered together with the unknown ids.
      .filter((id) => id !== "" && knownTagIds.has(id)),
    sort: sort === "asc" || sort === "desc" ? sort : defaultSearchState.sort,
  };
}

/**
 * Serialises a state back into a query string without the leading `?`.
 *
 * Only the fields that differ from the default are written, so a pristine search
 * produces `""` and the URL stays as clean as the page the user landed on. Tags are one
 * comma-separated parameter: Notion ids are UUIDs and cannot contain a comma, and a
 * repeated parameter would need its own merge rule on the way back in.
 */
export function searchStateToQuery(state: SearchState): string {
  const params = new URLSearchParams();
  if (state.query !== defaultSearchState.query) {
    params.set("q", state.query);
  }
  if (state.tagIds.length > 0) {
    params.set("tags", state.tagIds.join(","));
  }
  if (state.sort !== defaultSearchState.sort) {
    params.set("sort", state.sort);
  }
  // `URLSearchParams` percent-encodes the values, so a query holding spaces, accents or
  // an `&` round-trips through `parseSearchState` unchanged.
  return params.toString();
}

/**
 * Whether the state equals the default, which is the caller's cue to clear the query
 * string instead of leaving a bare `?` in the address bar.
 */
export function isDefaultSearchState(state: SearchState): boolean {
  return (
    state.query === defaultSearchState.query &&
    state.tagIds.length === defaultSearchState.tagIds.length &&
    state.sort === defaultSearchState.sort
  );
}
