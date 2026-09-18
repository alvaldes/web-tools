/**
 * Joins conditional class names.
 *
 * Deliberately dependency-free: `clsx` is only a transitive dependency here and
 * `tailwind-merge` is not installed, so this does not resolve conflicting Tailwind
 * utilities. Pass a class only once, or rely on source order within the same utility.
 */
export function cn(
  ...classes: Array<string | false | null | undefined>
): string {
  return classes.filter(Boolean).join(" ");
}

/**
 * Soft badge treatment shared by the tag pills on cards, in the filter bar and on the
 * detail page.
 *
 * Every variant is a translucent tint plus an inset hairline. The previous
 * `bg-{color}-900` fills were opaque surfaces, so a pill could land on a background of
 * its own colour: measured against `--card` (`#161820`), `gray` was `#111827` at a
 * **1.00:1** delta and read as bare text, and green/blue only reached 1.94:1 and 1.71:1.
 * A translucent fill cannot coincide with any surface, so the class of defect is closed
 * rather than the one entry that happened to be reported. The ring keeps the pill edge
 * visible where the tint is faint.
 *
 * Each string is written out in full on purpose. Tailwind scans source text for literal
 * candidates, so building these with a `bg-${color}-500/15` helper would emit no CSS at
 * all and every pill would silently render unstyled. Opacity modifiers also require
 * palette colours: the semantic tokens are raw `var(--...)` values that Tailwind cannot
 * compose with `/15`.
 */
export const colorVariants = {
  blue: "bg-blue-500/15 text-blue-300 ring-1 ring-inset ring-blue-400/25",
  red: "bg-red-500/15 text-red-300 ring-1 ring-inset ring-red-400/25",
  pink: "bg-pink-500/15 text-pink-300 ring-1 ring-inset ring-pink-400/25",
  gray: "bg-gray-500/15 text-gray-300 ring-1 ring-inset ring-gray-400/25",
  green: "bg-green-500/15 text-green-300 ring-1 ring-inset ring-green-400/25",
  yellow: "bg-yellow-500/15 text-yellow-300 ring-1 ring-inset ring-yellow-400/25",
  indigo: "bg-indigo-500/15 text-indigo-300 ring-1 ring-inset ring-indigo-400/25",
  purple: "bg-purple-500/15 text-purple-300 ring-1 ring-inset ring-purple-400/25",
  brown: "bg-amber-500/15 text-amber-300 ring-1 ring-inset ring-amber-400/25",
};

export type TagCategory = {
  name: string;
  tags: string[];
};

export const tagCategories: TagCategory[] = [
  {
    name: "Tipo",
    tags: ["color", "svg", "image", "css", "typography", "code", "ai", "dev"],
  },
  {
    name: "Función",
    tags: ["generator", "converter", "optimizer", "editor", "library", "inspector"],
  },
  {
    name: "Características",
    tags: ["free", "open source", "no login", "api"],
  },
  {
    name: "Contenido",
    tags: ["tutorial", "cheatsheet", "resource"],
  },
];

/**
 * Heading of the final filter group, which collects every tag no category above names.
 *
 * It lives here so the taxonomy copy stays in one file, and it is typed as the group
 * label rather than as a category because it holds whatever the data adds later.
 */
export const otherTagCategory = "Otros";
