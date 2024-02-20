import { isLoading, toolItems } from "@/lib/toolStore";
import { useStore } from "@nanostores/preact";
import Card from "./Card";
import { useEffect, useState } from "preact/hooks";

const Gallery = () => {
  const $tools = useStore(toolItems);
  const $isLoading = useStore(isLoading);
  const [toolsItems, setToolsItems] = useState(Object.values($tools));
  useEffect(() => {
    setToolsItems(Object.values($tools));
  }, [$tools]);

  return (
    <>
      {$isLoading ? (
        <div className="text-center">
          <div>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14rem"
              height="14rem"
              viewBox="0 0 24 24"
            >
              <circle cx={4} cy={12} r={1.5} fill="currentColor">
                <animate
                  attributeName="r"
                  dur="0.75s"
                  repeatCount="indefinite"
                  values="1.5;3;1.5"
                ></animate>
              </circle>
              <circle cx={12} cy={12} r={3} fill="currentColor">
                <animate
                  attributeName="r"
                  dur="0.75s"
                  repeatCount="indefinite"
                  values="3;1.5;3"
                ></animate>
              </circle>
              <circle cx={20} cy={12} r={1.5} fill="currentColor">
                <animate
                  attributeName="r"
                  dur="0.75s"
                  repeatCount="indefinite"
                  values="1.5;3;1.5"
                ></animate>
              </circle>
            </svg>
            <span className="sr-only">Loading...</span>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {toolsItems.map((item) => (
            <Card
              id={item.id}
              key={item.id}
              img={item.img}
              title={item.title}
              url={item.url}
              tags={item.tags}
            />
          ))}
        </div>
      )}
    </>
  );
};

export default Gallery;
