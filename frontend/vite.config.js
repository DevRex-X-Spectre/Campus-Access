import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    // SPA routes: /admin
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
