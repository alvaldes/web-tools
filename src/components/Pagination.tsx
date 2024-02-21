interface Props {
  isLoading: boolean;
  itemsPerPage: number;
  indexOfFirstItem: number;
  indexOfLastItem: number;
  totalItems: number;
  currentPage: number;
  setCurrentPage: (page: number) => void;
  setItemsPerPage: (itemsPerPage: number) => void;
}

const Pagination = ({
  isLoading,
  itemsPerPage,
  indexOfFirstItem,
  indexOfLastItem,
  totalItems,
  currentPage,
  setCurrentPage,
  setItemsPerPage,
}: Props) => {
  return (
    <div className={`flex flex-col items-center ${isLoading ? "hidden" : ""}`}>
      <span className="text-sm text-gray-400">
        Showing{" "}
        <span className="font-semibold text-white">{indexOfFirstItem}</span>{" "}
        <span className={`${itemsPerPage === 1 ? "hidden" : ""}`}>
          to <span className="font-semibold text-white">{indexOfLastItem}</span>
        </span>{" "}
        of <span className="font-semibold text-white">{totalItems}</span>{" "}
        Entries
      </span>
      <div className="inline-flex mt-2 xs:mt-0">
        <button
          className={`flex items-center justify-center px-3 h-8 text-sm font-medium rounded-s ${
            currentPage === 1
              ? "bg-gray-900 border-gray-800 text-gray-500 cursor-not-allowed"
              : "bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700 hover:text-white cursor-pointer"
          }`}
          disabled={currentPage === 1}
          onClick={() => setCurrentPage(currentPage - 1)}
        >
          <svg
            className="w-3.5 h-3.5 me-2 rtl:rotate-180"
            aria-hidden="true"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 14 10"
          >
            <path
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M13 5H1m0 0 4 4M1 5l4-4"
            ></path>
          </svg>
          Prev
        </button>
        <select
          className="flex items-center justify-center px-3 h-8 text-sm font-medium rounded-s bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700 hover:text-white cursor-pointer"
          onChange={(e) =>
            setItemsPerPage(parseInt((e.target as HTMLSelectElement).value))
          }
          value={itemsPerPage}
        >
          <option value="1">1 item per page</option>
          <option value="2">2 items per page</option>
          <option value="4">4 items per page</option>
          <option value="8">8 items per page</option>
        </select>
        <button
          className={`flex items-center justify-center px-3 h-8 text-sm font-medium border-0 border-s rounded-e ${
            currentPage === Math.ceil(totalItems / itemsPerPage)
              ? "bg-gray-900 border-gray-800 text-gray-500 cursor-not-allowed"
              : "bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700 hover:text-white cursor-pointer"
          }`}
          disabled={currentPage === Math.ceil(totalItems / itemsPerPage)}
          onClick={() => setCurrentPage(currentPage + 1)}
        >
          Next
          <svg
            className="w-3.5 h-3.5 ms-2 rtl:rotate-180"
            aria-hidden="true"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 14 10"
          >
            <path
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M1 5h12m0 0L9 1m4 4L9 9"
            ></path>
          </svg>
        </button>
      </div>
    </div>
  );
};
export default Pagination;
