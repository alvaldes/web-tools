import { defineConfig } from 'astro/config';
import tailwindcss from "@tailwindcss/vite";
import preact from "@astrojs/preact";

import vercel from "@astrojs/vercel";

// https://astro.build/config
export default defineConfig({
  integrations: [preact()],
  vite: {
    plugins: [tailwindcss()]
  },
  output: "server",
  adapter: vercel()
});