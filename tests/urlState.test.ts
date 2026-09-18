// Run by `bun test`. `bun-types` is not installed and this project takes no test dependency, so
// the specifier below has no declarations. `@ts-ignore` rather than `@ts-expect-error`:
// the latter fails the type check if the directives ever become resolvable, which would turn
// a future dependency install into a broken build for no reason.
// @ts-ignore -- "bun:test" has no type declarations without bun-types.
import { describe, expect, test } from "bun:test";
import {
  defaultSearchState,
  isDefaultSearchState,
  parseSearchState,
  searchStateToQuery,
  type SearchState,
} from "@/lib/urlState";

/** The catalog a link is validated against: `gone` is deliberately absent. */
const catalog: ReadonlySet<string> = new Set(["t1", "t2", "t3"]);

describe("parseSearchState", () => {
  test("parses an empty string back to the defaults", () => {
    expect(parseSearchState("", catalog)).toEqual(defaultSearchState);
  });

  test("accepts a query string with or without the leading question mark", () => {
    const withMark = parseSearchState("?q=figma&sort=desc", catalog);
    const withoutMark = parseSearchState("q=figma&sort=desc", catalog);
    expect(withMark).toEqual(withoutMark);
    expect(withMark.query).toBe("figma");
    expect(withMark.sort).toBe("desc");
  });

  test("drops a tag id the catalog does not know", () => {
    // A stale link must not filter against a tag that no longer exists: the id is
    // dropped, not trusted, and the ids that survive are kept.
    expect(parseSearchState("?tags=t1,gone", catalog).tagIds).toEqual(["t1"]);
  });

  test("drops every tag when none of them is known", () => {
    expect(parseSearchState("?tags=gone,also-gone", catalog).tagIds).toEqual([]);
  });

  test("keeps a bare or empty tags parameter out of the state", () => {
    expect(parseSearchState("?tags=", catalog).tagIds).toEqual([]);
    expect(parseSearchState("?tags=t1,", catalog).tagIds).toEqual(["t1"]);
  });

  test("falls back to the default order for an unknown sort value", () => {
    const parsed = parseSearchState("?sort=sideways", catalog);
    expect(parsed.sort).toBe(defaultSearchState.sort);
    expect(parsed).toEqual(defaultSearchState);
  });

  test("falls back for a missing sort rather than inventing one", () => {
    expect(parseSearchState("?q=figma", catalog).sort).toBe(
      defaultSearchState.sort,
    );
  });

  test("reads a query holding an encoded space, accent and ampersand", () => {
    expect(parseSearchState("?q=dise%C3%B1o+%26+color", catalog).query).toBe(
      "diseño & color",
    );
  });
});

describe("searchStateToQuery", () => {
  test("serialises the default state to an empty string", () => {
    expect(searchStateToQuery(defaultSearchState)).toBe("");
  });

  test("omits a field that already holds its default", () => {
    expect(searchStateToQuery({ query: "", tagIds: [], sort: "asc" })).toBe("");
    expect(searchStateToQuery({ query: "figma", tagIds: [], sort: "asc" })).toBe(
      "q=figma",
    );
    expect(searchStateToQuery({ query: "", tagIds: ["t1"], sort: "asc" })).toBe(
      "tags=t1",
    );
    expect(searchStateToQuery({ query: "", tagIds: [], sort: "desc" })).toBe(
      "sort=desc",
    );
  });

  test("serialises several tags as one comma-separated parameter", () => {
    const query = searchStateToQuery({
      query: "",
      tagIds: ["t1", "t2"],
      sort: "asc",
    });
    expect(query).toBe("tags=t1%2Ct2");
    expect(new URLSearchParams(query).getAll("tags")).toHaveLength(1);
  });

  test("percent-encodes a query so the separator stays unambiguous", () => {
    const query = searchStateToQuery({
      query: "a&b=c",
      tagIds: [],
      sort: "asc",
    });
    expect(query).not.toContain("b=c&");
    expect(new URLSearchParams(query).get("q")).toBe("a&b=c");
  });
});

describe("round trip", () => {
  const full: SearchState = {
    query: "diseño & color",
    tagIds: ["t1", "t3"],
    sort: "desc",
  };

  test("preserves a query with spaces, an accent, an ampersand, tags and a sort", () => {
    const parsed = parseSearchState(
      `?${searchStateToQuery(full)}`,
      catalog,
    );
    expect(parsed).toEqual(full);
  });

  test("preserves only the query when it is the only non-default field", () => {
    const state: SearchState = { query: "café con leche", tagIds: [], sort: "asc" };
    expect(parseSearchState(`?${searchStateToQuery(state)}`, catalog)).toEqual(
      state,
    );
  });

  test("preserves several tag ids and their order", () => {
    const state: SearchState = { query: "", tagIds: ["t3", "t1", "t2"], sort: "asc" };
    expect(parseSearchState(`?${searchStateToQuery(state)}`, catalog).tagIds).toEqual(
      ["t3", "t1", "t2"],
    );
  });

  test("round-trips the default state through its empty query string", () => {
    expect(
      parseSearchState(`?${searchStateToQuery(defaultSearchState)}`, catalog),
    ).toEqual(defaultSearchState);
  });
});

describe("isDefaultSearchState", () => {
  test("accepts the default state, including a fresh equal object", () => {
    expect(isDefaultSearchState(defaultSearchState)).toBe(true);
    expect(isDefaultSearchState({ query: "", tagIds: [], sort: "asc" })).toBe(
      true,
    );
  });

  test("rejects a state that differs only by sort", () => {
    expect(isDefaultSearchState({ ...defaultSearchState, sort: "desc" })).toBe(
      false,
    );
  });

  test("rejects a state that differs only by tags", () => {
    expect(isDefaultSearchState({ ...defaultSearchState, tagIds: ["t1"] })).toBe(
      false,
    );
  });

  test("rejects a state that differs only by query", () => {
    expect(isDefaultSearchState({ ...defaultSearchState, query: "figma" })).toBe(
      false,
    );
  });

  test("agrees with what the serialiser writes", () => {
    // The two have to stay consistent: a state the predicate calls default must not
    // serialise to a query string, or the URL would keep a search the caller believes
    // it cleared.
    const states: SearchState[] = [
      defaultSearchState,
      { query: "nope", tagIds: [], sort: "asc" },
      { query: "", tagIds: ["t1"], sort: "desc" },
    ];
    for (const state of states) {
      expect(searchStateToQuery(state) === "").toBe(isDefaultSearchState(state));
    }
  });
});
