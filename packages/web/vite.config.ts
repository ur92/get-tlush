import path from "node:path";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const packagesDir = path.resolve(rootDir, "..");

/** SPA fallback for Netlify production only — must not live in public/ (breaks netlify dev proxy). */
function spaRedirectsPlugin() {
  return {
    name: "tlush-spa-redirects",
    closeBundle() {
      writeFileSync(path.join(rootDir, "dist/_redirects"), "/*    /index.html   200\n");
    },
  };
}

export default defineConfig({
  plugins: [react(), spaRedirectsPlugin()],
  resolve: {
    alias: {
      "@tlush/auth": path.resolve(packagesDir, "auth/src"),
      "@tlush/analytics": path.resolve(packagesDir, "analytics/src"),
      "@tlush/pdf-extract": path.resolve(packagesDir, "pdf-extract/src"),
      "@tlush/parser-core": path.resolve(packagesDir, "parsers/core/src"),
      "@tlush/parser-hilan": path.resolve(packagesDir, "parsers/hilan/src"),
      "@tlush/parser-merkava": path.resolve(packagesDir, "parsers/merkava/src"),
      "@tlush/explain": path.resolve(packagesDir, "explain/src"),
      "@tlush/knowledge": path.resolve(packagesDir, "knowledge/src/browser.ts"),
    },
  },
  optimizeDeps: {
    exclude: ["pdfjs-dist"],
  },
  worker: {
    format: "es",
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
