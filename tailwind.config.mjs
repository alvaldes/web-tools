/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
  // The app is dark-only. `data-theme` is not read by Tailwind, so dark mode is driven
  // by a `dark` class on <html> and every `dark:` variant becomes deterministic.
  darkMode: "class",
  theme: {
    extend: {
      // Semantic tokens. Values live in src/layouts/Layout.astro so the palette has a
      // single source of truth instead of ad-hoc gray-* values per component.
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
      },
      // Without this, a bare `border` utility paints Tailwind's default gray-200
      // border color, which is invisible on a dark surface.
      borderColor: {
        DEFAULT: "var(--border)",
      },
    },
  },
  plugins: [],
};
