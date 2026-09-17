import type { JSX } from "preact";
import { cn } from "@/lib/utils";

/**
 * shadcn/ui-style card primitive.
 *
 * Composition:
 *
 *   Card
 *   ├── CardHeader
 *   │   ├── CardTitle
 *   │   ├── CardDescription
 *   │   └── CardAction
 *   ├── CardContent
 *   └── CardFooter
 *
 * Spacing is driven by the `--card-spacing` custom property, so a consumer can retune
 * the whole card inset at once, e.g. `className="[--card-spacing:1.5rem]"`.
 *
 * Tailwind 3 adaptations of the upstream (Tailwind 4) classes:
 * - `gap-(--card-spacing)` -> `gap-[var(--card-spacing)]`
 * - `has-data-[slot=…]` -> `[&:has([data-slot=…])]`: Tailwind 3.4 cannot stack the
 *   `data-*` variant inside `has-*` and silently drops the utility, so these are
 *   written as `&`-anchored arbitrary variants. Same for `[.border-b]` -> `[&.border-b]`:
 *   arbitrary variants without an explicit `&` are dropped.
 * - `@container/card-header` is dropped: container queries need a plugin that is not
 *   installed in this project.
 * - Token colors are plain CSS color values, so opacity modifiers (`bg-muted/50`) are
 *   not available. Use a dedicated token instead.
 */

type DivProps = PlainProps<HTMLDivElement>;

/**
 * Preact types `className` as `SignalLike<string | undefined>` and `size` as a number.
 * This primitive takes plain strings and its own `size` union, so both are narrowed here.
 * Signals are not used in this project.
 */
type PlainProps<T extends EventTarget> = Omit<
  JSX.HTMLAttributes<T>,
  "class" | "className" | "size"
> & {
  class?: string;
  className?: string;
};

export interface CardProps extends DivProps {
  size?: "default" | "sm";
}

export function Card({ className, size = "default", ...props }: CardProps) {
  return (
    <div
      data-slot="card"
      data-size={size}
      className={cn(
        "group/card flex flex-col gap-[var(--card-spacing)] overflow-hidden rounded-xl bg-card py-[var(--card-spacing)] text-sm text-card-foreground ring-1 ring-border",
        "[--card-spacing:1rem] data-[size=sm]:[--card-spacing:0.75rem]",
        "[&:has([data-slot=card-footer])]:pb-0",
        "[&:has(>img:first-child)]:pt-0 [&>img:first-child]:rounded-t-xl [&>img:last-child]:rounded-b-xl",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: DivProps) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "group/card-header grid auto-rows-min items-start gap-1 rounded-t-xl px-[var(--card-spacing)]",
        "[&:has([data-slot=card-action])]:grid-cols-[1fr_auto]",
        "[&:has([data-slot=card-description])]:grid-rows-[auto_auto]",
        "[&.border-b]:pb-[var(--card-spacing)]",
        className,
      )}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: PlainProps<HTMLHeadingElement>) {
  return (
    <h3
      data-slot="card-title"
      // Upstream uses `leading-none`; card titles here clamp to two lines, where a
      // collapsed line height crops descenders, so this uses `leading-snug`.
      className={cn("font-semibold leading-snug", className)}
      {...props}
    />
  );
}

export function CardDescription({ className, ...props }: PlainProps<HTMLParagraphElement>) {
  return (
    <p
      data-slot="card-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

export function CardAction({ className, ...props }: DivProps) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className,
      )}
      {...props}
    />
  );
}

export function CardContent({ className, ...props }: DivProps) {
  return (
    <div data-slot="card-content" className={cn("px-[var(--card-spacing)]", className)} {...props} />
  );
}

export function CardFooter({ className, ...props }: DivProps) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "flex items-center rounded-b-xl border-t border-border bg-muted p-[var(--card-spacing)]",
        className,
      )}
      {...props}
    />
  );
}
