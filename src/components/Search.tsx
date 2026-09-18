import { useEffect, useMemo, useState } from "preact/hooks";
import { type Tags, type WebTools } from "@/lib/notion";
import { filterTools, sortTools, type SortDirection } from "@/lib/query";
import type { FunctionalComponent } from "preact";
import Gallery from "./Gallery";
import SearchToolbar from "./SearchToolbar";

const Search: FunctionalComponent = () => {
  const [isLoading, setIsLoading] = useState(true);
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

  useEffect(() => {
    const loadCatalog = async () => {
      try {
        setIsLoading(true);
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
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };

    loadCatalog();
  }, []);

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
