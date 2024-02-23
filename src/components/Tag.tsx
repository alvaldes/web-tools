import { type Tags } from "@/lib/notion";
import { colorVariants } from "@/lib/utils";

interface Props {
  id: string;
  tags: Tags[];
}
const Tag = (props: Props) => {
  const tag: Tags | null =
    props.tags.find((item) => item.id === props.id) || null;
  let color = "blue";
  if (tag !== null) {
    color = tag.color;
  }

  return (
    <span
      className={`text-xs font-medium me-2 px-2.5 py-0.5 rounded-full ${
        colorVariants[color as keyof typeof colorVariants]
      }`}
    >
      {tag?.name}
    </span>
  );
};

export default Tag;
