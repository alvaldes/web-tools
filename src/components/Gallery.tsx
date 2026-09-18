import { useEffect, useState } from "preact/hooks";
import type { Tags, WebTools } from "@/lib/notion";
import Pagination from "./Pagination";
import ImageWithSkeleton from "./ImageWithSkeleton";
import ToolCard, { ToolCardSkeleton } from "./ToolCard";

interface Props {
  tools: WebTools[];
  isLoading: boolean;
  tags: Tags[];
}

const Gallery = ({ tools, isLoading, tags }: Props) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(8);

  const totalItems = tools.length;

  // A new result set starts at page 1, which is the intended UX after a search.
  useEffect(() => {
    setCurrentPage(1);
  }, [tools]);

  // The clamp is the structural guarantee behind that reset: even if an update lands
  // one render before the effect above, `currentPage` can never point past the last
  // page, so an empty grid over a non-zero total is impossible.
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const safePage = Math.min(currentPage, totalPages);

  const changeItemsPerPage = (itemsPerPage: number) => {
    setItemsPerPage(itemsPerPage);
    setCurrentPage(1);
  };

  const indexOfLastItem = safePage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = tools.slice(indexOfFirstItem, indexOfLastItem);

  // A single grid definition for both the skeleton and the loaded results, so the
  // layout does not shift when the data arrives.
  const gridClassName = `grid grid-cols-1 sm:grid-cols-2 gap-5 my-8 px-6 md:px-4 lg:px-0 ${
    itemsPerPage >= 4 ? "lg:grid-cols-3 xl:grid-cols-4" : ""
  }`;

  const paginationProps = {
    itemsPerPage,
    indexOfFirstItem: indexOfFirstItem + 1,
    indexOfLastItem: Math.min(indexOfLastItem, totalItems),
    totalItems,
    currentPage: safePage,
    setCurrentPage,
    setItemsPerPage: changeItemsPerPage,
    isLoading,
  };

  if (isLoading) {
    return (
      <section className={gridClassName} aria-busy="true">
        {Array.from({ length: itemsPerPage }).map((_, index) => (
          <ToolCardSkeleton key={index} />
        ))}
      </section>
    );
  }

  if (totalItems === 0) {
    return (
      <section className="flex justify-center flex-col max-w-[28rem] px-6 h-full my-auto">
        <ImageWithSkeleton
          src="notfound.svg"
          alt="Result Not Found"
          className="mx-auto w-fit h-52 sm:h-60 opacity-65"
        />
        <p className="text-xl sm:text-3xl font-thin text-center mt-2 tracking-wide text-pretty">
          Oops! Couldn't find any results matching your search
        </p>
      </section>
    );
  }

  return (
    <section>
      <Pagination {...paginationProps} />
      <div className={gridClassName}>
        {currentItems.map((item: any) => (
          <ToolCard
            key={item.id}
            id={item.id}
            title={item.title}
            url={item.url}
            img={item.img}
            tagIds={item.tags}
            tags={tags}
          />
        ))}
      </div>
      <Pagination {...paginationProps} />
    </section>
  );
};

export default Gallery;
