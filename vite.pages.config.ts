import path from "node:path";
import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  root: path.resolve("pages-static"),
  base: "/TrueTurn/",
  publicDir: path.resolve("public"),
  plugins: [tailwindcss(), viteReact()],
  resolve: {
    tsconfigPaths: true,
    alias: [
      {
        find: "@/lib/platform/api",
        replacement: path.resolve("src/lib/platform/api.client.ts"),
      },
    ],
  },
  define: {
    "import.meta.env.VITE_PAGES": JSON.stringify("1"),
  },
  build: {
    outDir: path.resolve("dist-pages"),
    emptyOutDir: true,
  },
});
