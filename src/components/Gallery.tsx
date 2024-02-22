import { isLoading, toolItems } from "@/lib/toolStore";
import { useStore } from "@nanostores/preact";
import Card from "./Card";
import { useEffect, useState } from "preact/hooks";
import Pagination from "./Pagination";
import ImageWithSkeleton from "./ImageWithSkeleton";

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
        <section
          className={`grid grid-cols-1 md:grid-cols-2 gap-5 my-8 px-6 md:px-4 lg:px-0`}
        >
          {[1, 2].map((item) => (
            <div className="w-full max-w-sm border rounded-lg shadow bg-gray-800 border-gray-700">
              <picture className="aspect-video w-full h-auto flex-none">
                <ImageWithSkeleton
                  className="rounded-t-lg aspect-video w-full h-48 m-auto object-cover"
                  src="imagenskeleton.jpg"
                  alt="imagen skeleton"
                />
              </picture>
              <div className="mx-5 mt-3 mb-5 flex flex-col justify-between">
                <div className="animate-pulse bg-gray-200 w-32 h-5 rounded-md"></div>
                <div className="mt-auto">
                  <div className="flex items-center mt-2.5 mb-5">
                    <div className="animate-pulse bg-gray-200 w-24 h-5 rounded-md"></div>
                    <div className="animate-pulse bg-gray-200 w-20 h-5 ml-2 rounded-md"></div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="animate-pulse bg-gray-200 w-14 h-6 rounded-md"></div>
                    <div className="animate-pulse bg-gray-200 w-32 h-8 rounded-md"></div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </section>
      ) : totalItems === 0 ? (
        <section
          className={`flex justify-center flex-col max-w-[28rem] px-6 h-full my-auto`}
        >
          <ImageWithSkeleton
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
