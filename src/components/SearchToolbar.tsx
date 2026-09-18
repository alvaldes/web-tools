import { useMemo, useRef, useState } from "preact/hooks";
import type { Tags, WebTools } from "@/lib/notion";
import {
  countToolsByTag,
  groupTagsByCategory,
  type SortDirection,
} from "@/lib/query";
import { cn, otherTagCategory, tagCategories } from "@/lib/utils";
import Filter from "./Filter";
import Popover from "./ui/popover";
import SortControl from "./SortControl";
import TagFilterPanel from "./TagFilterPanel";

type OpenPanel = "filters" | "sort" | null;

interface Props {
  tools: WebTools[];
  tags: Tags[];
  isLoading: boolean;
  searchFilter: string;
  onSearchInput: (value: string) => void;
  selectedTagIds: string[];
  onToggleTag: (tag: Tags) => void;
  onRemoveFilter: (id: string) => void;
  sortDirection: SortDirection;
  onSortDirectionChange: (direction: SortDirection) => void;
  resultCount: number;
}

const sortOptions: { label: string; direction: SortDirection }[] = [
  { label: "Name A→Z", direction: "asc" },
  { label: "Name Z→A", direction: "desc" },
];

const chevron = (
  <svg
    className="h-2.5 w-2.5"
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
);

/**
 * The toolbar bar: the search field, the two popover triggers on top, and the active
 * chips, the sort chip and the result count underneath.
 *
 * It owns exactly one piece of state -- which panel is open -- because the panels have
 * to be mutually exclusive. Everything the bar renders is either a prop or a pure
 * derivation of one, so the island in `Search.tsx` stays data and state only.
 */
export default function SearchToolbar({
  tools,
  tags,
  isLoading,
  searchFilter,
  onSearchInput,
  selectedTagIds,
  onToggleTag,
  onRemoveFilter,
  sortDirection,
  onSortDirectionChange,
  resultCount,
}: Props) {
  const [openPanel, setOpenPanel] = useState<OpenPanel>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // The options follow the loaded catalog rather than `tagCategories` alone: a tag
  // nobody carries disappears from the list, and a tag added in Notion appears in
  // "Otros" without a code change. Both derivations are pure, so they run here instead
  // of in the island but cost nothing per keystroke.
  const tagGroups = useMemo(
    () =>
      groupTagsByCategory(
        tags,
        countToolsByTag(tools),
        tagCategories,
        otherTagCategory,
      ),
    [tags, tools],
  );

  const hasText = searchFilter !== "";
  const isFilterOpen = openPanel === "filters";
  const isSortOpen = openPanel === "sort";

  const closePanel = () => setOpenPanel(null);

  const clearSearch = () => {
    onSearchInput("");
    // The clear button unmounts itself as soon as the field empties, so focus is put
    // back on the field explicitly instead of being left on a removed element.
    searchInputRef.current?.focus();
  };

  const selectSortDirection = (direction: SortDirection) => {
    onSortDirectionChange(direction);
    closePanel();
  };

  // Deliberately not the paginator's "Showing X to Y of N Entries" wording: this counts
  // the result set, the paginator counts the current page of it.
  const resultLabel =
    resultCount === 0
      ? "No results"
      : resultCount === 1
        ? "1 result"
        : `${resultCount} results`;

  // Both triggers stay disabled until the catalog is in, otherwise the panels open on
  // an empty list.
  const triggerClassName = (isOpen: boolean) =>
    cn(
      "inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2.5 text-sm font-medium text-foreground",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      isOpen ? "bg-muted" : "bg-card hover:bg-muted",
      isLoading ? "cursor-wait opacity-60" : "cursor-pointer",
    );

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center gap-2 p-2">
        {/*
          The clear button lives inside the field's own frame, so the border is not
          interrupted between the text and the button and no absolutely positioned
          overlay is needed.
        */}
        <div className="flex min-w-[12rem] flex-1 items-center rounded-lg border border-border bg-muted ps-3 focus-within:ring-2 focus-within:ring-ring">
          <label htmlFor="search-input" className="sr-only">
            Search
          </label>
          <input
            ref={searchInputRef}
            id="search-input"
            type="text"
            className="w-full bg-transparent py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none disabled:cursor-wait"
            placeholder="Search tools…"
            disabled={isLoading}
            value={searchFilter}
            // `onInput`, not `onChange`: Preact core binds `onChange` to the native
            // `change` event, which a text input only fires on blur, so the grid would
            // lag a click behind the typing.
            onInput={(e) => onSearchInput(e.currentTarget.value)}
          />
          {hasText && (
            <button
              type="button"
              aria-label="Clear search"
              className="me-1 inline-flex items-center justify-center rounded-full p-1.5 text-muted-foreground hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={clearSearch}
            >
              <span aria-hidden="true">×</span>
            </button>
          )}
        </div>

        <Popover
          isOpen={isFilterOpen}
          onClose={closePanel}
          labelledBy="tag-filter-trigger"
          panelClassName="max-h-96 w-56 overflow-y-auto"
          trigger={(triggerProps) => (
            <button
              {...triggerProps}
              type="button"
              disabled={isLoading}
              className={triggerClassName(isFilterOpen)}
              // The primitive cannot open the panel by itself (it does not own
              // `isOpen`), so opening happens here and the closing half is delegated
              // back to the handler the primitive passed in.
              onClick={() =>
                isFilterOpen
                  ? triggerProps.onClick()
                  : setOpenPanel("filters")
              }
            >
              Filters
              {selectedTagIds.length > 0 && (
                <span className="inline-flex min-w-5 items-center justify-center rounded-full border border-border bg-background px-1 text-xs font-semibold tabular-nums">
                  {selectedTagIds.length}
                </span>
              )}
              {chevron}
            </button>
          )}
        >
          <TagFilterPanel
            groups={tagGroups}
            selectedTagIds={selectedTagIds}
            onToggle={onToggleTag}
          />
        </Popover>

        <Popover
          isOpen={isSortOpen}
          onClose={closePanel}
          labelledBy="sort-trigger"
          panelClassName="w-40"
          trigger={(triggerProps) => (
            <button
              {...triggerProps}
              type="button"
              disabled={isLoading}
              className={triggerClassName(isSortOpen)}
              onClick={() =>
                isSortOpen ? triggerProps.onClick() : setOpenPanel("sort")
              }
            >
              Sort
              {chevron}
            </button>
          )}
        >
          <div id="sort-panel" data-slot="sort-panel" className="p-1">
            {sortOptions.map((option) => {
              const isActive = sortDirection === option.direction;
              return (
                <button
                  key={option.direction}
                  type="button"
                  aria-pressed={isActive}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isActive
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                  onClick={() => selectSortDirection(option.direction)}
                >
                  {/* Reserve the glyph's column in both rows so the two labels align. */}
                  <span aria-hidden="true" className="w-3 text-center">
                    {isActive ? "✓" : ""}
                  </span>
                  {option.label}
                </button>
              );
            })}
          </div>
        </Popover>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-border px-2 py-2">
        {selectedTagIds.map((filter) => (
          <Filter
            id={filter}
            tags={tags}
            removeFilter={onRemoveFilter}
            key={filter}
          />
        ))}
        <SortControl
          direction={sortDirection}
          onToggle={() =>
            onSortDirectionChange(sortDirection === "asc" ? "desc" : "asc")
          }
        />
        <span className="ms-auto text-sm text-muted-foreground">{resultLabel}</span>
      </div>
    </div>
  );
}
