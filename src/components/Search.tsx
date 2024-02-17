import { useState } from "preact/hooks";
import { useStore } from "@nanostores/preact";
import { isLoading, saveTagItem, tagsItems } from "@/lib/toolStore";
import { getTools, searchTools, type Tags } from "@/lib/notion";
import Filter from "./Filter";

export default function Search({ fetchTags }: { fetchTags: Tags[] }) {
  const [isDropOpen, setIsDropOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [searchFilter, setSearchFilter] = useState<string>("");
  const $isLoading = useStore(isLoading);
  const $tags = useStore(tagsItems);
  saveTagItem(fetchTags);

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
    setIsDropOpen(false);
  };

  const removeFilter = (id: string) => {
    let draft: Set<string> = new Set(categoryFilter);
    draft.delete(id);
    setCategoryFilter([...draft]);
  };

  const convertCategory = (id: string) => {
    return $tags[id].name;
  };

  const convertCategoryList = (ids: string[]) => {
    return ids.map((id) => {
      return convertCategory(id);
    });
  };

  const search = async (e: any) => {
    e.preventDefault();
    console.log("🚀 ~ searchFilter:", searchFilter);
    let draft = await getTools();
    console.log("🚀 ~ draft:", draft);
    // setCategoryFilter([...draft]);
  };

  return (
    <>
      {isDropOpen && (
        <div
          className="fixed inset-0 z-10 bg-black opacity-50 cursor-default"
          onClick={() => setIsDropOpen(false)}
        ></div>
      )}
      <form class="w-[80%] my-8">
        <div class="flex">
          <label
            for="search-dropdown"
            class="mb-2 text-sm font-medium text-gray-900 sr-only dark:text-white"
          >
            Search
          </label>
          <button
            id="dropdown-button"
            class="flex-shrink-0 z-20 inline-flex items-center py-2.5 px-4 text-sm font-medium text-center text-gray-900 bg-gray-100 border border-gray-300 rounded-s-lg hover:bg-gray-200 focus:ring-4 focus:outline-none focus:ring-gray-100 dark:bg-gray-700 dark:hover:bg-gray-600 dark:focus:ring-gray-700 dark:text-white dark:border-gray-600"
            type="button"
            onClick={toogleDropdown}
          >
            All Categories{" "}
            <svg
              class="w-2.5 h-2.5 ms-2.5"
              aria-hidden="true"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 10 6"
            >
              <path
                stroke="currentColor"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="m1 1 4 4 4-4"
              ></path>
            </svg>
          </button>
          <div
            id="dropdown"
            class={`absolute mt-11 z-20 ${
              isDropOpen ? "" : `hidden`
            } bg-white divide-y divide-gray-100 rounded-lg shadow w-44 dark:bg-gray-700`}
          >
            <ul class="py-2 text-sm text-gray-700 dark:text-gray-200">
              {Object.keys($tags).map((tag) => (
                <li>
                  <button
                    type="button"
                    class="inline-flex w-full px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 dark:hover:text-white"
                    onClick={() => selectCategory($tags[tag])}
                  >
                    <input
                      type="checkbox"
                      checked={categoryFilter.includes(tag)}
                      class="mr-1 my-auto"
                    />
                    {$tags[tag].name}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div class="relative w-full">
            <input
              type="search"
              id="search-dropdown"
              class="block p-2.5 w-full z-20 text-sm text-gray-900 bg-gray-50 rounded-e-lg border-s-gray-50 border-s-2 border border-gray-300 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-s-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:border-blue-500"
              placeholder="Search Mockups, Logos, Design Templates..."
              required
              value={searchFilter}
              onChange={(e: any) => setSearchFilter(e.target?.value ?? "")}
            />
            <button
              type="button"
              onClick={(e) => search(e)}
              class="absolute top-0 end-0 p-2.5 text-sm font-medium h-full text-white bg-blue-700 rounded-e-lg border border-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800"
            >
              <svg
                class="w-4 h-4"
                aria-hidden="true"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 20 20"
              >
                <path
                  stroke="currentColor"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="m19 19-4-4m0-7A7 7 0 1 1 1 8a7 7 0 0 1 14 0Z"
                ></path>
              </svg>
              <span class="sr-only">Search</span>
            </button>
          </div>
        </div>
        <div class="mt-2 flex gap-2 flex-wrap">
          {categoryFilter.map((filter) => (
            <Filter id={filter} tags={$tags} removeFilter={removeFilter} />
          ))}
        </div>
      </form>
    </>
  );
}
