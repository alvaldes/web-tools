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

export const colorVariants = {
  blue: "bg-blue-900 text-blue-300",
  red: "bg-red-900 text-red-300",
  pink: "bg-pink-900 text-pink-300",
  gray: "bg-gray-900 text-gray-300",
  green: "bg-green-900 text-green-300",
  yellow: "bg-yellow-900 text-yellow-300",
  indigo: "bg-indigo-900 text-indigo-300",
  purple: "bg-purple-900 text-purple-300",
};
