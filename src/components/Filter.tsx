import { colorVariants } from "@/lib/utils";
import type { Tags } from "@/lib/notion";

interface Props {
  id: string;
  tags: Record<string, Tags>;
  removeFilter: (id: string) => void;
}

export default function Filter(props: Props) {
  const tag = props.tags[props.id];
  let color = "blue";
  if (tag !== null) {
    color = tag.color;
  }
  return (
    <span
      class={`inline-flex items-center px-2 py-1 me-2 text-sm font-medium rounded ${
        colorVariants[color as keyof typeof colorVariants]
      }`}
    >
      {tag?.name}
      <button
        type="button"
        class={`inline-flex items-center p-1 ms-2 text-sm rounded-sm hover:text-black/40 hover:font-black ${
          colorVariants[color as keyof typeof colorVariants]
        }`}
        onClick={() => props.removeFilter(props.id)}
      >
        <svg
          class="w-2 h-2"
          aria-hidden="true"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 14 14"
        >
          <path
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="m1 1 6 6m0 0 6 6M7 7l6-6M7 7l-6 6"
          ></path>
        </svg>
        <span class="sr-only">Remove badge</span>
      </button>
    </span>
  );
}
