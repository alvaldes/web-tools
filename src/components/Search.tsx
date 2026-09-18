import { useEffect, useMemo, useState } from "preact/hooks";
import { type Tags, type WebTools } from "@/lib/notion";
import { filterTools, sortTools, type SortDirection } from "@/lib/query";
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

  const toggleTag = (tag: Tags) => {
    if (categoryFilter.includes(tag.id)) {
      let draft: Set<string> = new Set(categoryFilter);
      draft.delete(tag.id);
      setCategoryFilter([...draft]);
    } else {
      let draft: Set<string> = new Set([...categoryFilter, tag.id]);
      setCategoryFilter([...draft]);
    }
  };

  const removeFilter = (id: string) => {
    let draft: Set<string> = new Set(categoryFilter);
    draft.delete(id);
    setCategoryFilter([...draft]);
  };

  // One implementation for both the mount effect and the error block's retry button, so
  // a retry cannot drift from the first load.
  const loadCatalog = async () => {
    try {
      setIsLoading(true);
      setLoadError(null);
      const [toolsResponse, tagsResponse] = await Promise.all([
        fetch("/api/tools.json", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }),
        fetch("/api/tags.json", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }),
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
          onSearchInput={setSearchFilter}
          selectedTagIds={categoryFilter}
          onToggleTag={toggleTag}
          onRemoveFilter={removeFilter}
          sortDirection={sortDirection}
          onSortDirectionChange={setSortDirection}
          resultCount={results.length}
        />
      </form>
      <Gallery tools={results} isLoading={isLoading} tags={tags} />
    </section>
  );
};

export default Search;
