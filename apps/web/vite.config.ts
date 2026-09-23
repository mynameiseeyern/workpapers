import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwind()],
  server: {
    // In development, PocketBase runs on 8090; the SPA talks to it via /api.
    proxy: { "/api": "http://127.0.0.1:8090", "/_": "http://127.0.0.1:8090" },
  },
  build: { outDir: "dist", sourcemap: true },
});
