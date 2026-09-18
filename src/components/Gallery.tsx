import { useEffect, useRef, useState } from "preact/hooks";
import gsap from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";
import type { Tags, WebTools } from "@/lib/notion";
import ImageWithSkeleton from "./ImageWithSkeleton";
import ToolCard, { ToolCardSkeleton } from "./ToolCard";

gsap.registerPlugin(ScrollTrigger);

interface Props {
  tools: WebTools[];
  isLoading: boolean;
  tags: Tags[];
}

const BATCH_SIZE = 8;

const Gallery = ({ tools, isLoading, tags }: Props) => {
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(0);

  const totalItems = tools.length;
  const visibleItems = tools.slice(0, visibleCount);
  const hasMore = visibleCount < totalItems;

  // Reset visible count when the tool list changes (new search/filter)
  useEffect(() => {
    setVisibleCount(BATCH_SIZE);
    prevCountRef.current = 0;
  }, [tools]);

  // Animate newly added items with stagger
  useEffect(() => {
    if (!gridRef.current) return;

    const newItems = gridRef.current.querySelectorAll(
      `[data-index]:not([data-animated])`,
    );

    if (newItems.length > 0) {
      gsap.fromTo(
        newItems,
        { opacity: 0, y: 20 },
        {
          opacity: 1,
          y: 0,
          duration: 0.3,
          stagger: 0.04,
          ease: "power2.out",
          onComplete: () => {
            newItems.forEach((el) =>
              el.setAttribute("data-animated", "true"),
            );
          },
        },
      );
    }

    prevCountRef.current = visibleItems.length;
  }, [visibleItems.length]);

  // Load more when user is 600px from the end (~2 rows of cards)
  // Re-create on every visibleCount change so the trigger tracks the sentinel's
  // new DOM position after items are appended.
  useEffect(() => {
    if (!hasMore || !sentinelRef.current) return;

    // Kill any previous trigger first
    ScrollTrigger.getAll().forEach((trigger: ReturnType<typeof ScrollTrigger.create>) => trigger.kill());

    const trigger = ScrollTrigger.create({
      trigger: sentinelRef.current,
      start: "top bottom+=600",
      onEnter: () => {
        setVisibleCount((prev) => Math.min(prev + BATCH_SIZE, totalItems));
      },
    });

    return () => {
      trigger.kill();
    };
  }, [hasMore, totalItems, visibleCount]);

  // A single grid definition for both the skeleton and the loaded results
  const gridClassName =
    "grid grid-cols-1 sm:grid-cols-2 gap-5 my-8 px-6 md:px-4 lg:px-0 lg:grid-cols-3 xl:grid-cols-4";

  if (isLoading) {
    return (
      <section className={gridClassName} aria-busy="true">
        {Array.from({ length: BATCH_SIZE }).map((_, index) => (
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
      <div ref={gridRef} className={gridClassName}>
        {visibleItems.map((item: any, index: number) => (
          <div
            key={item.id}
            data-index={index}
            data-animated={index < prevCountRef.current ? "true" : undefined}
            className={
              index < prevCountRef.current ? "opacity-100" : "opacity-0"
            }
          >
            <ToolCard
              id={item.id}
              title={item.title}
              url={item.url}
              img={item.img}
              tagIds={item.tags}
              tags={tags}
            />
          </div>
        ))}
      </div>

      {/* Invisible sentinel for infinite scroll — no spinner needed, data is in-memory */}
      {hasMore && <div ref={sentinelRef} className="h-1" aria-hidden="true" />}

      {!hasMore && totalItems > BATCH_SIZE && (
        <p className="text-center text-sm text-muted-foreground py-6">
          Showing all {totalItems} results
        </p>
      )}
    </section>
  );
};

export default Gallery;
