import { access } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadPluginManifests } from "./load-manifests";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const PLUGINS_DIR = join(ROOT, "specs/plugins");

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

describe("plugin contract manifests", () => {
  it("loads every specs/plugins/*/manifest.json", async () => {
    const manifests = await loadPluginManifests();

    expect(manifests.length).toBeGreaterThan(0);
    expect(manifests.map((m) => m.plugin).sort()).toEqual(["hilan", "merkava"]);
  });

  it.each(["hilan", "merkava"])(
    "manifest for %s declares fixtures with expected golden files",
    async (plugin) => {
      const manifests = await loadPluginManifests();
      const entry = manifests.find((m) => m.plugin === plugin);

      expect(entry).toBeDefined();
      expect(entry!.manifest.fixtures.length).toBeGreaterThan(0);

      for (const fixture of entry!.manifest.fixtures) {
        const expectedPath = join(PLUGINS_DIR, plugin, fixture.expected);
        const pdfPath = join(ROOT, fixture.pdf);

        expect(
          await pathExists(expectedPath),
          `missing expected fixture: specs/plugins/${plugin}/${fixture.expected}`
        ).toBe(true);

        // PDF fixtures are gitignored — presence is optional except when running parse contract tests.
        const pdfExists = await pathExists(pdfPath);
        if (!pdfExists) {
          expect(fixture.id).toBeDefined();
        }
      }
    }
  );
});
