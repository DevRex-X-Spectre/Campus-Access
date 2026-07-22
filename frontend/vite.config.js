import { copyFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/** Ensure SPA deep links work on static hosts (Render, etc.). */
function spaFallbackPlugin() {
  return {
    name: "spa-fallback",
    closeBundle() {
      const dist = resolve(__dirname, "dist");
      const index = resolve(dist, "index.html");
      if (!existsSync(index)) return;
      // Many static hosts serve 404.html for unknown paths
      copyFileSync(index, resolve(dist, "404.html"));
    },
  };
}

export default defineConfig({
  plugins: [react(), spaFallbackPlugin()],
  server: {
    port: 5173,
    host: true,
  },
  preview: {
    port: 5173,
  },
  build: {
    outDir: "dist",
    sourcemap: false,
  },
  appType: "spa",
});
