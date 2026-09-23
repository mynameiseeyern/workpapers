import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";

// APP_VERSION comes from CI (the commit SHA); "dev" locally.
const version = (process.env.APP_VERSION || "dev").slice(0, 7);

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(version) },
  plugins: [react(), tailwind()],
  server: {
    // In development, PocketBase runs on 8090; the SPA talks to it via /api.
    proxy: { "/api": "http://127.0.0.1:8090", "/_": "http://127.0.0.1:8090" },
  },
  build: { outDir: "dist", sourcemap: true },
});
