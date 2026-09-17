import { type Tags } from "@/lib/notion";
import { cn, colorVariants } from "@/lib/utils";

interface Props {
  id: string;
  tags: Tags[];
  className?: string;
}

const Tag = ({ id, tags, className }: Props) => {
  const tag = tags.find((item) => item.id === id);

  // A relation can point at a tag that is filtered out or was deleted in Notion.
  // Rendering nothing is better than an empty, invisible pill with its own margin.
  if (!tag) return null;

  const variant =
    colorVariants[tag.color as keyof typeof colorVariants] ?? colorVariants.blue;

  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium",
        variant,
        className,
      )}
    >
      {tag.name}
    </span>
  );
};

export default Tag;
