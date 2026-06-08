import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const packagesDir = path.resolve(rootDir, "../../packages");

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@tlush/auth": path.resolve(packagesDir, "auth/src"),
      "@tlush/analytics": path.resolve(packagesDir, "analytics/src"),
      "@tlush/pdf-extract": path.resolve(packagesDir, "pdf-extract/src"),
      "@tlush/parser-core": path.resolve(packagesDir, "parsers/core/src"),
      "@tlush/parser-hilan": path.resolve(packagesDir, "parsers/hilan/src"),
      "@tlush/parser-merkava": path.resolve(packagesDir, "parsers/merkava/src"),
    },
  },
  optimizeDeps: {
    exclude: ["pdfjs-dist"],
  },
  worker: {
    format: "es",
  },
});
