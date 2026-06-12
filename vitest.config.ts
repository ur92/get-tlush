import { defineConfig } from "vitest/config";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@tlush/knowledge": join(ROOT, "packages/knowledge/src/index.ts"),
      "@tlush/calculator": join(ROOT, "packages/calculator/src/index.ts"),
      "@tlush/explain": join(ROOT, "packages/explain/src/index.ts"),
      "@tlush/pdf-extract": join(ROOT, "packages/pdf-extract/src/index.ts"),
      "@tlush/parser-core": join(ROOT, "packages/parsers/core/src/index.ts"),
      "@tlush/parser-hilan": join(ROOT, "packages/parsers/hilan/src/index.ts"),
      "@tlush/parser-merkava": join(ROOT, "packages/parsers/merkava/src/index.ts"),
      "@tlush/ingest": join(ROOT, "packages/ingest/src/index.ts"),
      "@tlush/analytics": join(ROOT, "packages/analytics/src/index.ts"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
