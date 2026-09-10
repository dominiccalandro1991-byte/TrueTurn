import path from "node:path";
import { existsSync, mkdirSync, renameSync } from "node:fs";
import { defineConfig, type Plugin } from "vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

function flattenPagesHtml(): Plugin {
  return {
    name: "flatten-pages-html",
    closeBundle() {
      const nested = path.resolve("dist-pages/pages-static/index.html");
      const flat = path.resolve("dist-pages/index.html");
      if (existsSync(nested)) {
        mkdirSync(path.dirname(flat), { recursive: true });
        renameSync(nested, flat);
      }
    },
  };
}

export default defineConfig({
  root: path.resolve("."),
  base: "/TrueTurn/",
  publicDir: path.resolve("public"),
  plugins: [tailwindcss(), viteReact(), flattenPagesHtml()],
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
    rollupOptions: {
      input: path.resolve("pages-static/index.html"),
    },
  },
});
