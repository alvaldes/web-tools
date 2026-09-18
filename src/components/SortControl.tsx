import type { SortDirection } from "@/lib/query";
import { cn } from "@/lib/utils";

interface Props {
  direction: SortDirection;
  onToggle: () => void;
}

/**
 * The active-sort chip of the toolbar row. It reads as a toggle and not as a second
 * search button, and clicking it inverts the order.
 *
 * It used to carry an `ms-2` that cleared the old search button's edge; the bar now
 * spaces its row with a `gap`, so the offset is gone.
 */
export default function SortControl({ direction, onToggle }: Props) {
  const isAscending = direction === "asc";
  const current = isAscending ? "Name A to Z" : "Name Z to A";
  const next = isAscending ? "Name Z to A" : "Name A to Z";

  return (
    <button
      type="button"
      className={cn(
        "flex-shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium",
        "bg-card text-muted-foreground border border-border",
        "hover:bg-muted hover:text-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
      aria-label={`Sort by name, currently ${current}. Activate to sort ${next}.`}
      onClick={onToggle}
    >
      Name
      <span aria-hidden="true">{isAscending ? "↑" : "↓"}</span>
    </button>
  );
}
