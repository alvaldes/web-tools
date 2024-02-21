import { isLoading, toolItems } from "@/lib/toolStore";
import { useStore } from "@nanostores/preact";
import Card from "./Card";
import { useEffect, useState } from "preact/hooks";
import Pagination from "./Pagination";

const Gallery = () => {
  const $tools = useStore(toolItems);
  const $isLoading = useStore(isLoading);
  const [toolsItems, setToolsItems] = useState(Object.values($tools));
  const [totalItems, setTotalItems] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(8);

  useEffect(() => {
    setToolsItems(Object.values($tools));
    setTotalItems(Object.values($tools).length);
  }, [$tools]);

  const changeItemsPerPage = (itemsPerPage: number) => {
    setItemsPerPage(itemsPerPage);
    setCurrentPage(1);
  };

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = toolsItems.slice(indexOfFirstItem, indexOfLastItem);

  return (
    <>
      {$isLoading ? (
        <section className="text-center">
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
        </section>
      ) : totalItems === 0 ? (
        <section
          className={`flex justify-center flex-col max-w-[28rem] px-6 h-full my-auto`}
        >
          <img
            src="notfound.svg"
            alt="Result Not Found"
            className="mx-auto w-fit h-52 sm:h-60 opacity-65"
          />
          <p
            className={`text-xl sm:text-3xl font-thin text-center mt-2 tracking-wide text-pretty`}
          >
            Oops! Couldn't find any results matching your search
          </p>
        </section>
      ) : (
        <section>
          <Pagination
            itemsPerPage={itemsPerPage}
            indexOfFirstItem={indexOfFirstItem + 1}
            indexOfLastItem={
              indexOfLastItem > totalItems ? totalItems : indexOfLastItem
            }
            totalItems={totalItems}
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
            setItemsPerPage={changeItemsPerPage}
            isLoading={$isLoading}
          />
          <div
            className={`grid grid-cols-1 ${
              itemsPerPage >= 4
                ? "md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                : itemsPerPage === 2 && "md:grid-cols-2"
            } gap-5 my-8 px-6 md:px-4 lg:px-0`}
          >
            {currentItems.map((item) => (
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
          <Pagination
            itemsPerPage={itemsPerPage}
            indexOfFirstItem={indexOfFirstItem + 1}
            indexOfLastItem={
              indexOfLastItem > totalItems ? totalItems : indexOfLastItem
            }
            totalItems={totalItems}
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
            setItemsPerPage={changeItemsPerPage}
            isLoading={$isLoading}
          />
        </section>
      )}
    </>
  );
};

export default Gallery;
