import { saveToolItem, toolItems } from "@/lib/toolStore";
import { useStore } from "@nanostores/preact";
import Card from "./Card";
import { useEffect, useState } from "preact/hooks";

const Gallery = () => {
  const $tools = useStore(toolItems);
  const [toolsItems, setToolsItems] = useState(Object.values($tools));
  useEffect(() => {
    setToolsItems(Object.values($tools));
  }, [$tools]);

  return (
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
      {toolsItems.map((item) => (
        <Card
          id={item.id}
          img={item.img}
          title={item.title}
          url={item.url}
          tags={item.tags}
        />
      ))}
    </div>
  );
};

export default Gallery;
