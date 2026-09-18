import type { Tags } from "@/lib/notion";
import type { TagGroup } from "@/lib/query";

interface Props {
  groups: TagGroup[];
  selectedTagIds: string[];
  onToggle: (tag: Tags) => void;
}

/**
 * The tag rows of the filter popover.
 *
 * Grouping, sorting and the zero-count filtering all happen in `lib/query`, so this
 * component only draws what it is handed. The old dropdown derived its own rows from
 * `tagCategories` and offered ten tags that carried no tool at all.
 */
export default function TagFilterPanel({ groups, selectedTagIds, onToggle }: Props) {
  return (
    <div
      id="tag-filter-panel"
      data-slot="tag-filter-panel"
      aria-labelledby="tag-filter-heading"
    >
      <p
        id="tag-filter-heading"
        className="px-4 pb-1 pt-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
      >
        Filter by tag
      </p>
      {groups.map((group, index) => {
        const headingId = `tag-filter-group-${index}`;
        return (
          <div key={group.name} data-slot="tag-filter-group">
            <p
              id={headingId}
              className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              {group.name}
            </p>
            <ul aria-labelledby={headingId} className="pb-1 text-sm">
              {group.options.map(({ tag, count }) => (
                <li key={tag.id}>
                  {/*
                    A real `<label>` around a real checkbox. The previous row was a
                    `<button>` wrapping an `<input type="checkbox">`, which nests two
                    interactive elements the platform cannot describe as one control
                    and gives a single choice two tab stops.
                  */}
                  <label className="flex cursor-pointer items-center gap-2 px-4 py-2 hover:bg-muted hover:text-foreground">
                    <input
                      type="checkbox"
                      // `accent-primary`: without it the checkbox keeps the browser's
                      // default accent, which is the one control in the bar that would
                      // not be drawn from the app's palette.
                      className="my-auto accent-primary"
                      checked={selectedTagIds.includes(tag.id)}
                      // `onChange` is right on a checkbox: it fires as the box is
                      // toggled. A text field is the opposite case, where the native
                      // `change` event only arrives on blur.
                      onChange={() => onToggle(tag)}
                    />
                    <span>{tag.name}</span>
                    <span className="ms-auto text-xs tabular-nums text-muted-foreground">
                      {count}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
