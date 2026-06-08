import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export type PluginFixture = {
  id: string;
  pdf: string;
  expected: string;
  requiredFlags?: string[];
  assertions?: Record<string, number>;
};

export type PluginManifest = {
  plugin: string;
  version: string;
  amountTolerance: number;
  fixtures: PluginFixture[];
};

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const PLUGINS_DIR = join(ROOT, "specs/plugins");

export async function loadPluginManifests(): Promise<
  Array<{ plugin: string; path: string; manifest: PluginManifest }>
> {
  const entries = await readdir(PLUGINS_DIR, { withFileTypes: true });
  const results: Array<{ plugin: string; path: string; manifest: PluginManifest }> = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const manifestPath = join(PLUGINS_DIR, entry.name, "manifest.json");
    const raw = await readFile(manifestPath, "utf8");
    const manifest = JSON.parse(raw) as PluginManifest;

    results.push({
      plugin: entry.name,
      path: manifestPath,
      manifest,
    });
  }

  return results;
}
