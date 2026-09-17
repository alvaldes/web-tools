import { cn } from "@/lib/utils";

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

// The state classes used to set only a border *color* with no border width, so no
// border ever rendered. `border` is now part of the base classes.
const buttonBase =
  "flex items-center justify-center h-8 px-3 text-sm font-medium border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const buttonEnabled =
  "bg-muted border-border text-muted-foreground hover:bg-card hover:text-foreground cursor-pointer";
const buttonDisabled =
  "bg-background border-border text-muted-foreground opacity-60 cursor-not-allowed";

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
  const isFirstPage = currentPage === 1;
  const isLastPage = currentPage === Math.ceil(totalItems / itemsPerPage);

  return (
    <div className={cn("flex flex-col items-center gap-2", isLoading && "hidden")}>
      <p className="text-sm text-muted-foreground">
        Showing{" "}
        <span className="font-semibold text-foreground">{indexOfFirstItem}</span>
        {itemsPerPage !== 1 && (
          <>
            {" "}
            to{" "}
            <span className="font-semibold text-foreground">
              {indexOfLastItem}
            </span>
          </>
        )}{" "}
        of <span className="font-semibold text-foreground">{totalItems}</span>{" "}
        Entries
      </p>
      <div className="inline-flex mt-2 xs:mt-0">
        <button
          className={cn(
            buttonBase,
            "me-0.5 rounded-s",
            isFirstPage ? buttonDisabled : buttonEnabled,
          )}
          disabled={isFirstPage}
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
            />
          </svg>
          Prev
        </button>
        <select
          aria-label="Items per page"
          className="flex items-center justify-center px-1 h-8 text-sm font-medium border bg-muted border-border text-muted-foreground hover:text-foreground cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&>option]:bg-popover [&>option]:text-popover-foreground"
          onChange={(e) =>
            setItemsPerPage(Number((e.target as HTMLSelectElement).value))
          }
          value={itemsPerPage}
        >
          <option value="1">1 item per page</option>
          <option value="2">2 items per page</option>
          <option value="4">4 items per page</option>
          <option value="8">8 items per page</option>
        </select>
        <button
          className={cn(
            buttonBase,
            "ms-0.5 rounded-e",
            isLastPage ? buttonDisabled : buttonEnabled,
          )}
          disabled={isLastPage}
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
            />
          </svg>
        </button>
      </div>
    </div>
  );
};
export default Pagination;
