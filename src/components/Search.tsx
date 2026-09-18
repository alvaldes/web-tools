import { useEffect, useMemo, useState } from "preact/hooks";
import { type Tags, type WebTools } from "@/lib/notion";
import { filterTools, sortTools, type SortDirection } from "@/lib/query";
import { tagCategories } from "@/lib/utils";
import Filter from "./Filter";
import type { FunctionalComponent } from "preact";
import Gallery from "./Gallery";
import SortControl from "./SortControl";

const Search: FunctionalComponent = () => {
  const [isDropOpen, setIsDropOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [tools, setTools] = useState<WebTools[]>([]);
  const [tags, setTags] = useState<Tags[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [searchFilter, setSearchFilter] = useState<string>("");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [placeholder, setPlaceholder] = useState("Search");

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

  const toogleDropdown = () => {
    setIsDropOpen(!isDropOpen);
  };

  const selectCategory = (tag: Tags) => {
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

  const toggleSortDirection = () => {
    setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
  };

  const handleResize = () => {
    if (window.innerWidth <= 550) {
      setPlaceholder("Search Colors, News...");
    } else {
      setPlaceholder("Search Colors, News, Designs, and more...");
    }
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
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <>
      {isDropOpen && (
        <button
          className="fixed inset-0 z-10 bg-black opacity-50 cursor-default"
          onClick={() => setIsDropOpen(false)}
          aria-label="Close dropdown"
          type="button"
        ></button>
      )}
      <section>
        <form
          className="w-[90%] sm:w-[80%] mt-8 mb-4 mx-auto"
          onSubmit={(e) => e.preventDefault()}
        >
          <div className="flex items-center">
            <label
              htmlFor="search-dropdown"
              className="mb-2 text-sm font-medium text-foreground sr-only"
            >
              Search
            </label>
            <button
              id="dropdown-button"
              disabled={tags.length == 0 || isLoading}
              className={`flex-shrink-0 z-20 inline-flex items-center py-2.5 px-4 text-sm font-medium text-center border rounded-s-lg rounded-e-none focus:ring-2 focus:outline-none bg-muted focus:ring-ring text-foreground border-border ${
                tags.length == 0 || isLoading
                  ? "cursor-wait"
                  : "cursor-pointer hover:bg-card"
              }`}
              type="button"
              onClick={toogleDropdown}
            >
              All Categories{" "}
              <svg
                className="w-2.5 h-2.5 ms-2.5"
                aria-hidden="true"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 10 6"
              >
                <path
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="m1 1 4 4 4-4"
                ></path>
              </svg>
            </button>
            <div
              id="dropdown"
              className={`absolute mt-12 z-20 ${
                isDropOpen ? "" : `hidden`
              } bg-popover divide-y divide-border rounded-lg shadow-lg w-56 max-h-96 overflow-y-auto`}
            >
              {tagCategories.map((category) => {
                const categoryTags = tags.filter((tag) =>
                  category.tags.includes(tag.name.toLowerCase())
                );
                if (categoryTags.length === 0) return null;
                return (
                  <div key={category.name}>
                    <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {category.name}
                    </div>
                    <ul className="py-1 text-sm">
                      {categoryTags.map((tag) => (
                        <li key={tag.id}>
                          <button
                            type="button"
                            className="inline-flex w-full items-center px-4 py-2 hover:bg-muted hover:text-foreground cursor-pointer"
                            onClick={() => selectCategory(tag)}
                          >
                            <input
                              type="checkbox"
                              checked={categoryFilter.includes(tag.id)}
                              className="mr-2 my-auto"
                            />
                            {tag.name}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
            <div className="relative w-full">
              <input
                type="text"
                id="search-dropdown"
                className={`block p-2.5 pr-12 w-full z-20 text-sm rounded-s-none rounded-e-lg border-s-2 border focus:ring-ring focus:border-ring focus:ring-2 focus:outline-none bg-muted border-s-border border-border placeholder:text-muted-foreground text-foreground ${
                  isLoading ? "cursor-wait" : "cursor-text"
                }`}
                placeholder={placeholder}
                disabled={isLoading}
                value={searchFilter}
                onChange={(e: any) => setSearchFilter(e.target?.value ?? "")}
              />
              <button
                type="submit"
                disabled={isLoading}
                className={`absolute top-0 end-0 p-2.5 text-sm font-medium h-full text-primary-foreground rounded-e-lg border focus:ring-2 focus:outline-none ${
                  isLoading
                    ? "border-border bg-card cursor-wait"
                    : "border-transparent bg-primary hover:brightness-110 focus:ring-ring cursor-pointer"
                }`}
              >
                {isLoading ? (
                  <svg
                    aria-hidden="true"
                    className="inline w-4 h-4 text-muted-foreground animate-spin [&>path:first-child]:opacity-25"
                    viewBox="0 0 100 101"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z"
                      fill="currentColor"
                    />
                    <path
                      d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z"
                      fill="currentColor"
                    />
                  </svg>
                ) : (
                  <svg
                    className="w-4 h-4"
                    aria-hidden="true"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 20 20"
                  >
                    <path
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="m19 19-4-4m0-7A7 7 0 1 1 1 8a7 7 0 0 1 14 0Z"
                    ></path>
                  </svg>
                )}
                <span className="sr-only">Search</span>
              </button>
            </div>
            <SortControl
              direction={sortDirection}
              onToggle={toggleSortDirection}
            />
          </div>
          <div className="mt-2 flex gap-2 flex-wrap">
            {categoryFilter.map((filter) => (
              <Filter
                id={filter}
                tags={tags}
                removeFilter={removeFilter}
                key={filter}
              />
            ))}
          </div>
        </form>
        <Gallery tools={results} isLoading={isLoading} tags={tags} />
      </section>
    </>
  );
};

export default Search;
