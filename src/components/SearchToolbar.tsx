import { useMemo, useRef } from "preact/hooks";
import type { Tags, WebTools } from "@/lib/notion";
import {
  countToolsByTag,
  groupTagsByCategory,
  type SortDirection,
} from "@/lib/query";
import { otherTagCategory, tagCategories } from "@/lib/utils";
import Filter from "./Filter";
import PillDropdown from "./PillDropdown";
import SortControl from "./SortControl";
import TagFilterDropdown from "./TagFilterDropdown";

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

/**
 * The toolbar: search input + sort button on row 1, category pills on row 2,
 * active filter chips + result count on row 3.
 *
 * Each category pill opens a dropdown with checkboxes for the tags in that
 * category, inspired by Framer's Pill Dropdown Nav pattern.
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
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Group tags by category with live counts
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

  // Count active tags per group for the pill badges
  const activeCountByGroup = useMemo(() => {
    const counts = new Map<string, number>();
    for (const group of tagGroups) {
      const active = group.options.filter((opt) =>
        selectedTagIds.includes(opt.tag.id),
      ).length;
      if (active > 0) {
        counts.set(group.name, active);
      }
    }
    return counts;
  }, [tagGroups, selectedTagIds]);

  const hasText = searchFilter !== "";

  const clearSearch = () => {
    onSearchInput("");
    searchInputRef.current?.focus();
  };

  const toggleSort = () => {
    onSortDirectionChange(sortDirection === "asc" ? "desc" : "asc");
  };

  const resultLabel =
    resultCount === 0
      ? "No results"
      : resultCount === 1
        ? "1 result"
        : `${resultCount} results`;

  return (
    <div className="rounded-xl border border-border bg-card">
      {/* Row 1: Search input */}
      <div className="p-2">
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
            onInput={(e) => onSearchInput(e.currentTarget.value)}
          />
          {hasText && (
            <button
              type="button"
              aria-label="Clear search"
              className="me-1 inline-flex items-center justify-center rounded-full p-1.5 text-muted-foreground hover:bg-muted/80 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={clearSearch}
            >
              <span aria-hidden="true">×</span>
            </button>
          )}
        </div>
      </div>

      {/* Row 2: Category pills + Sort */}
      {tagGroups.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-t border-border px-2 py-2">
          {tagGroups.map((group) => (
            <PillDropdown
              key={group.name}
              label={group.name}
              count={activeCountByGroup.get(group.name)}
              isActive={activeCountByGroup.has(group.name)}
              disabled={isLoading}
            >
              <TagFilterDropdown
                options={group.options}
                selectedTagIds={selectedTagIds}
                onToggle={onToggleTag}
              />
            </PillDropdown>
          ))}
          <div className="ms-auto">
            <SortControl direction={sortDirection} onToggle={toggleSort} />
          </div>
        </div>
      )}

      {/* Row 3: Active filter chips + result count */}
      <div className="flex flex-wrap items-center gap-2 border-t border-border px-2 py-2">
        {selectedTagIds.map((filter) => (
          <Filter
            id={filter}
            tags={tags}
            removeFilter={onRemoveFilter}
            key={filter}
          />
        ))}
        <span className="ms-auto text-sm text-muted-foreground">
          {resultLabel}
        </span>
      </div>
    </div>
  );
}
