import type { SortDirection } from "@/lib/query";
import { cn } from "@/lib/utils";

interface Props {
  direction: SortDirection;
  onToggle: () => void;
}

/**
 * The sort control of the toolbar, drawn as a chip so it reads as a toggle and not as
 * a second search button. Clicking it inverts the order.
 */
export default function SortControl({ direction, onToggle }: Props) {
  const isAscending = direction === "asc";
  const current = isAscending ? "Name A to Z" : "Name Z to A";
  const next = isAscending ? "Name Z to A" : "Name A to Z";

  return (
    <button
      type="button"
      className={cn(
        // `ms-2` and not a `gap` on the toolbar row: the dropdown button and the input
        // are a joined group with flush corners, so a row gap would break that seam.
        "flex-shrink-0 ms-2 inline-flex items-center gap-1 rounded-full py-0.5 ps-2.5 pe-1 text-xs font-medium",
        "bg-muted text-muted-foreground border border-border",
        "hover:bg-card hover:text-foreground",
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
