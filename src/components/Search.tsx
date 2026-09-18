import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { type Tags, type WebTools } from "@/lib/notion";
import { filterTools, sortTools, type SortDirection } from "@/lib/query";
import {
  isDefaultSearchState,
  parseSearchState,
  searchStateToQuery,
  type SearchState,
} from "@/lib/urlState";
import type { FunctionalComponent } from "preact";
import Gallery from "./Gallery";
import SearchToolbar from "./SearchToolbar";

const Search: FunctionalComponent = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tools, setTools] = useState<WebTools[]>([]);
  const [tags, setTags] = useState<Tags[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [searchFilter, setSearchFilter] = useState<string>("");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  // The catalog the loaded tags define, held in a ref so the `popstate` listener --
  // registered once on mount -- can validate a link's tag ids against the latest
  // catalog without being torn down and re-added every time the tags change.
  const knownTagIdsRef = useRef<ReadonlySet<string>>(new Set());

  // The catalog is fetched once and then only used to resolve tag ids to names, so the
  // map is built here instead of on every keystroke.
  const tagsById = useMemo(
    () => new Map(tags.map((tag) => [tag.id, tag] as const)),
    [tags],
  );

  // Filtering and sorting are pure functions in `lib/query`, so every interaction is
  // derived from state and no round trip is needed to see the result.
  const results = useMemo(
    () =>
      sortTools(
        filterTools(tools, categoryFilter, searchFilter, tagsById),
        sortDirection,
      ),
    [tools, categoryFilter, searchFilter, tagsById, sortDirection],
  );

  /**
   * Writes a state to the address bar.
   *
   * A pristine search drops the query string entirely rather than leaving a bare `?`;
   * `isDefaultSearchState` is the single place that decision is made.
   */
  const writeUrl = (state: SearchState, mode: "push" | "replace") => {
    const { pathname, hash } = window.location;
    const url = isDefaultSearchState(state)
      ? `${pathname}${hash}`
      : `${pathname}?${searchStateToQuery(state)}${hash}`;
    if (mode === "push") {
      window.history.pushState(null, "", url);
    } else {
      window.history.replaceState(null, "", url);
    }
  };

  /** Pushes a parsed state into the component, without writing anything back. */
  const applySearchState = (state: SearchState) => {
    setSearchFilter(state.query);
    setCategoryFilter(state.tagIds);
    setSortDirection(state.sort);
  };

  // Every write below happens inside a change handler and never in an effect. An effect
  // that mirrored state into the URL would re-run on the write it caused, and with a
  // `popstate` listener applying the URL back into state the two would ping-pong.
  // Handlers run once per real user action, so the loop cannot start.
  const updateSearch = (value: string) => {
    setSearchFilter(value);
    // Typing is continuous: `pushState` would leave one history entry per keystroke, so
    // the current entry is rewritten and Back skips the typing.
    writeUrl(
      { query: value, tagIds: categoryFilter, sort: sortDirection },
      "replace",
    );
  };

  const toggleTag = (tag: Tags) => {
    const draft: Set<string> = new Set(categoryFilter);
    if (draft.has(tag.id)) {
      draft.delete(tag.id);
    } else {
      draft.add(tag.id);
    }
    const tagIds = [...draft];
    setCategoryFilter(tagIds);
    // A toggle is a discrete action, so it pushes an entry and Back undoes it.
    writeUrl({ query: searchFilter, tagIds, sort: sortDirection }, "push");
  };

  const removeFilter = (id: string) => {
    const tagIds = categoryFilter.filter((tagId) => tagId !== id);
    setCategoryFilter(tagIds);
    // Discrete as well: removing a chip is undone by Back, not overwritten.
    writeUrl({ query: searchFilter, tagIds, sort: sortDirection }, "push");
  };

  const changeSortDirection = (direction: SortDirection) => {
    setSortDirection(direction);
    writeUrl(
      { query: searchFilter, tagIds: categoryFilter, sort: direction },
      "push",
    );
  };

  // One implementation for both the mount effect and the error block's retry button, so
  // a retry cannot drift from the first load.
  const loadCatalog = async () => {
    try {
      setIsLoading(true);
      setLoadError(null);
      const [toolsResponse, tagsResponse] = await Promise.all([
        fetch("/api/tools.json", { method: "GET" }),
        fetch("/api/tags.json", { method: "GET" }),
      ]);
      if (!toolsResponse.ok) {
        throw new Error(`HTTP error! status: ${toolsResponse.status}`);
      }
      if (!tagsResponse.ok) {
        throw new Error(`HTTP error! status: ${tagsResponse.status}`);
      }
      const [toolsData, tagsData] = await Promise.all([
        toolsResponse.json(),
        tagsResponse.json(),
      ]);
      setTools(toolsData);
      setTags(tagsData);
      // The URL is read only once the catalog is in, because validating a tag id needs
      // the ids that were just fetched: parsing on mount could not tell a live tag from
      // a stale one. Nothing can race this read -- the field and both popover triggers
      // stay disabled until loading finishes, so there is no user input to lose.
      const knownTagIds = new Set<string>(
        tagsData.map((tag: Tags) => tag.id),
      );
      knownTagIdsRef.current = knownTagIds;
      applySearchState(parseSearchState(window.location.search, knownTagIds));
    } catch (e) {
      // The error object still goes to the console for diagnosis, but the user gets a
      // message: without this state a transport failure rendered the very same "No
      // results" as a successful load that matched nothing.
      console.error(e);
      setLoadError(
        "We couldn't load the tools. Check your connection and try again.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCatalog();
    // Runs once on mount. A retry goes through the error block's own button instead of
    // depending on this effect re-running.
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      // The URL is the source of truth on entry and here, and only here: a Back or
      // Forward press is applied to the component and nothing is written back, so the
      // restored state cannot echo itself into history.
      applySearchState(
        parseSearchState(window.location.search, knownTagIdsRef.current),
      );
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // The error block replaces the toolbar and the gallery outright. The empty state is
  // rendered by `Gallery`, so not mounting it is exactly what keeps "the load failed"
  // and "the load succeeded and matched nothing" from looking identical. The framing
  // matches the form's, so the switch between the two does not shift the layout.
  if (loadError !== null) {
    return (
      <section>
        <div
          role="alert"
          className="w-[90%] sm:w-[80%] mt-8 mb-4 mx-auto rounded-xl border border-border bg-card p-6 text-center"
        >
          <p className="text-sm text-muted-foreground">{loadError}</p>
          <button
            type="button"
            className="mt-4 inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={loadCatalog}
          >
            Try again
          </button>
        </div>
      </section>
    );
  }

  return (
    <section>
      {/*
        The form stays even though nothing is submitted: with no `<form>` a text input
        has no implicit submission to cancel, and Enter would be free to propagate.
      */}
      <form
        className="w-[90%] sm:w-[80%] mt-8 mb-4 mx-auto"
        onSubmit={(e) => e.preventDefault()}
      >
        <SearchToolbar
          tools={tools}
          tags={tags}
          isLoading={isLoading}
          searchFilter={searchFilter}
          onSearchInput={updateSearch}
          selectedTagIds={categoryFilter}
          onToggleTag={toggleTag}
          onRemoveFilter={removeFilter}
          sortDirection={sortDirection}
          onSortDirectionChange={changeSortDirection}
          resultCount={results.length}
        />
      </form>
      <Gallery tools={results} isLoading={isLoading} tags={tags} />
    </section>
  );
};

export default Search;
