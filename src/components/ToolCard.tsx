import type { Tags } from "@/lib/notion";
import ImageWithSkeleton from "./ImageWithSkeleton";
import Tag from "./Tag";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "./ui/card";

export interface ToolCardProps {
  id: string;
  title: string;
  url: string;
  img: string;
  /** Tag relation ids, resolved against the `tags` catalog. */
  tagIds: string[];
  tags: Tags[];
}

/**
 * A single tool in the listing.
 *
 * The whole card navigates to the tool detail page: the title link owns the accessible
 * name and stretches an `::after` overlay across the card. The external "Visit site"
 * link sits above that overlay, so one card exposes exactly one primary destination
 * without nesting anchors. The hover ring on the card is what signals the stretched
 * link; an arrow in the footer was removed because it read as if it belonged to the
 * external link.
 *
 * Titles are clamped with `line-clamp-2` instead of being truncated in JavaScript, which
 * keeps every card in a row the same height.
 */
export default function ToolCard({ id, title, url, img, tagIds, tags }: ToolCardProps) {
  return (
    <Card className="relative h-full transition-shadow hover:ring-ring focus-within:ring-2 focus-within:ring-ring">
      <div className="-mx-[var(--card-spacing)] -mt-[var(--card-spacing)] aspect-video w-full shrink-0 overflow-hidden bg-muted">
        <ImageWithSkeleton
          className="h-full w-full object-cover object-top transition-transform duration-300 group-hover/card:scale-105"
          src={img}
          alt={`Preview of ${title}`}
          loading="lazy"
          decoding="async"
        />
      </div>
      <CardHeader>
        {/* CardTitle has no font size of its own: shadcn keeps the primitive neutral and
            the card root sets text-sm. This is a content card, so the title is promoted. */}
        <CardTitle className="text-base">
          <a
            href={`/${id}`}
            title={title}
            className="line-clamp-2 after:absolute after:inset-0 focus-visible:outline-none"
          >
            {title}
          </a>
        </CardTitle>
      </CardHeader>
      {tagIds.length > 0 && (
        <CardContent className="flex flex-wrap items-center gap-2">
          {tagIds.map((tagId) => (
            <Tag key={tagId} id={tagId} tags={tags} />
          ))}
        </CardContent>
      )}
      <CardFooter className="mt-auto gap-2 py-2.5">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="relative z-10 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Visit site
          <span className="sr-only">(opens in a new tab)</span>
          <svg
            className="h-3 w-3 rtl:rotate-[270deg]"
            aria-hidden="true"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 18 18"
          >
            <path
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M15 11v4.833A1.166 1.166 0 0 1 13.833 17H2.167A1.167 1.167 0 0 1 1 15.833V4.167A1.166 1.166 0 0 1 2.167 3h4.618m4.447-2H17v5.768M9.111 8.889l7.778-7.778"
            />
          </svg>
        </a>
      </CardFooter>
    </Card>
  );
}

/**
 * Loading placeholder for a `ToolCard`. Built from the same primitive so the loading and
 * loaded structures cannot drift apart.
 */
export function ToolCardSkeleton() {
  return (
    <Card className="h-full" aria-hidden="true">
      <div className="-mx-[var(--card-spacing)] -mt-[var(--card-spacing)] aspect-video w-full shrink-0 animate-pulse bg-muted" />
      <CardHeader>
        <div className="h-5 w-3/4 animate-pulse rounded bg-muted" />
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <div className="h-5 w-20 animate-pulse rounded-full bg-muted" />
        <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
      </CardContent>
      <CardFooter className="mt-auto">
        <div className="h-5 w-20 animate-pulse rounded bg-muted" />
      </CardFooter>
    </Card>
  );
}
