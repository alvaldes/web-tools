import { cn, colorVariants } from "@/lib/utils";
import type { Tags } from "@/lib/notion";

interface Props {
  id: string;
  tags: Tags[];
  removeFilter: (id: string) => void;
}

export default function Filter({ id, tags, removeFilter }: Props) {
  const tag = tags.find((item) => item.id === id);
  if (!tag) return null;

  const variant =
    colorVariants[tag.color as keyof typeof colorVariants] ?? colorVariants.blue;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full py-0.5 pe-1 ps-2.5 text-xs font-medium",
        variant,
      )}
    >
      {tag.name}
      <button
        type="button"
        // The previous `hover:text-black/40` darkened the text on an already dark
        // surface; a translucent overlay keeps the chip legible while adding hover.
        className="inline-flex items-center rounded-full p-1 transition-colors hover:bg-black/25 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => removeFilter(id)}
      >
        <svg
          className="h-2 w-2"
          aria-hidden="true"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 14 14"
        >
          <path
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="m1 1 6 6m0 0 6 6M7 7l6-6M7 7l-6 6"
          />
        </svg>
        <span className="sr-only">Remove {tag.name} filter</span>
      </button>
    </span>
  );
}
