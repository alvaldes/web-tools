import type { Tags } from "@/lib/notion";
import type { TagGroupOption } from "@/lib/query";
import { cn } from "@/lib/utils";

interface Props {
  options: TagGroupOption[];
  selectedTagIds: string[];
  onToggle: (tag: Tags) => void;
}

/**
 * The dropdown content for a single pill: a list of checkboxes for the tags
 * in that category. Each row shows the tag name and its tool count.
 *
 * Extracted from TagFilterPanel to keep the pill dropdown self-contained.
 */
export default function TagFilterDropdown({
  options,
  selectedTagIds,
  onToggle,
}: Props) {
  if (options.length === 0) {
    return (
      <p className="px-3 py-2 text-sm text-muted-foreground">
        No tags in this category
      </p>
    );
  }

  return (
    <ul className="py-1 text-sm">
      {options.map(({ tag, count }) => {
        const isSelected = selectedTagIds.includes(tag.id);
        return (
          <li key={tag.id}>
            <label
              className={cn(
                "flex cursor-pointer items-center gap-2 px-3 py-1.5",
                "hover:bg-muted hover:text-foreground",
                isSelected && "bg-muted/50",
              )}
            >
              <input
                type="checkbox"
                className="my-auto accent-primary"
                checked={isSelected}
                onChange={() => onToggle(tag)}
              />
              <span className="flex-1">{tag.name}</span>
              <span className="text-xs tabular-nums text-muted-foreground">
                {count}
              </span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}
