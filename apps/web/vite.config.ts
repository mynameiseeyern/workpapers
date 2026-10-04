import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";

// APP_VERSION comes from CI (the commit SHA); "dev" locally.
const version = (process.env.APP_VERSION || "dev").slice(0, 7);

/**
 * The OCR engine looks for its English data at <langPath>/eng.traineddata.gz. Serve it from this app at /ocr/
 * (in development and in the built site) so reading a receipt never calls out to a CDN.
 */
function ocrData(): Plugin {
  const file = createRequire(import.meta.url).resolve("@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz");
  return {
    name: "workpapers-ocr-data",
    configureServer(server) {
      server.middlewares.use("/ocr/eng.traineddata.gz", (_req, res) => { res.setHeader("Content-Type", "application/gzip"); res.end(readFileSync(file)); });
    },
    generateBundle() { this.emitFile({ type: "asset", fileName: "ocr/eng.traineddata.gz", source: readFileSync(file) }); },
  };
}

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(version) },
  plugins: [react(), tailwind(), ocrData()],
  server: {
    // In development, PocketBase runs on 8090; the SPA talks to it via /api.
    proxy: { "/api": "http://127.0.0.1:8090", "/_": "http://127.0.0.1:8090" },
  },
  build: { outDir: "dist", sourcemap: true },
});
