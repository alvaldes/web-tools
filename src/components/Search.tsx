import { useEffect, useState } from "preact/hooks";
import { useStore } from "@nanostores/preact";
import {
  saveIsLoading,
  saveTagItem,
  saveToolItem,
  tagsItems,
} from "@/lib/toolStore";
import { type Tags } from "@/lib/notion";
import Filter from "./Filter";
import type { FunctionalComponent } from "preact";

const Search: FunctionalComponent = () => {
  const [isDropOpen, setIsDropOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [searchFilter, setSearchFilter] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const $tags = useStore(tagsItems);

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

  const search = async (e: any) => {
    e.preventDefault();
    setIsLoading(true);
    saveIsLoading(true);
    let draft = await fetch("/api/tools.json", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tags: categoryFilter,
        query: searchFilter,
      }),
    }).then((res) => res.json());
    saveToolItem(draft);
    setIsLoading(false);
    saveIsLoading(false);
  };

  useEffect(() => {
    const fetchTools = async () => {
      try {
        setIsLoading(true);
        saveIsLoading(true);
        const res = await fetch("/api/tools.json", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            tags: [],
            query: "",
          }),
        });
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        const data = await res.json();
        saveToolItem(data);
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
        saveIsLoading(false);
      }
    };
    fetchTools();

    const fetchTags = async () => {
      try {
        setIsLoading(false);
        saveIsLoading(false);
        const res = await fetch("/api/tags.json", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        const data = await res.json();
        saveTagItem(data);
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
        saveIsLoading(false);
      }
    };
    fetchTags();
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
      <form className="w-[80%] my-8">
        <div className="flex">
          <label
            htmlFor="search-dropdown"
            className="mb-2 text-sm font-medium text-gray-900 sr-only dark:text-white"
          >
            Search
          </label>
          <button
            id="dropdown-button"
            disabled={Object.keys($tags).length == 0}
            className={`flex-shrink-0 z-20 inline-flex items-center py-2.5 px-4 text-sm font-medium text-center border rounded-s-lg focus:ring-2 focus:outline-none bg-gray-700 hover:bg-gray-600 focus:ring-gray-700 text-white border-gray-600 ${
              Object.keys($tags).length == 0 ? "cursor-wait" : "cursor-pointer"
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
            } bg-white divide-y divide-gray-100 rounded-lg shadow w-44 dark:bg-gray-700`}
          >
            <ul className="py-2 text-sm text-gray-200">
              {Object.keys($tags).map((tag) => (
                <li key={tag}>
                  <button
                    type="button"
                    className="inline-flex w-full px-4 py-2 hover:bg-gray-600 hover:text-white"
                    onClick={() => selectCategory($tags[tag])}
                  >
                    <input
                      type="checkbox"
                      checked={categoryFilter.includes(tag)}
                      className="mr-1 my-auto"
                    />
                    {$tags[tag].name}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div className="relative w-full">
            <input
              type="search"
              id="search-dropdown"
              className="block p-2.5 w-full z-20 text-sm rounded-e-lg border-s-2 border focus:ring-blue-500 focus:border-blue-500 bg-gray-700 border-s-gray-700 border-gray-600 placeholder-gray-400 text-white"
              placeholder="Search Mockups, Logos, Design Templates..."
              required
              value={searchFilter}
              onChange={(e: any) => setSearchFilter(e.target?.value ?? "")}
            />
            <button
              type="button"
              disabled={isLoading}
              onClick={(e) => search(e)}
              className={`absolute top-0 end-0 p-2.5 text-sm font-medium h-full text-white rounded-e-lg border  focus:ring-2 focus:outline-none ${
                isLoading
                  ? "border-gray-600 bg-gray-800 cursor-wait"
                  : "border-blue-700 bg-blue-600 hover:bg-blue-700 focus:ring-blue-800 cursor-pointer"
              }`}
            >
              {isLoading ? (
                <svg
                  aria-hidden="true"
                  className="inline w-4 h-4 text-gray-200 animate-spin dark:text-gray-600"
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
                    fill="#1C64F2"
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
        </div>
        <div className="mt-2 flex gap-2 flex-wrap">
          {categoryFilter.map((filter) => (
            <Filter
              id={filter}
              tags={$tags}
              removeFilter={removeFilter}
              key={filter}
            />
          ))}
        </div>
      </form>
    </>
  );
};

export default Search;
