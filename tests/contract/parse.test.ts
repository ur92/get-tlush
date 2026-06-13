import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { hilanParser } from "@tlush/parser-hilan";
import { merkavaParser } from "@tlush/parser-merkava";
import { extractPdf } from "@tlush/pdf-extract";
import { describe, expect, it } from "vitest";
import { loadPluginManifests, type PluginFixture } from "./load-manifests";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

const PARSERS = {
  hilan: hilanParser,
  merkava: merkavaParser,
} as const;

async function pathExists(path: string): Promise<boolean> {
  try {
    await readFile(path);
    return true;
  } catch {
    return false;
  }
}

function getAssertionValue(parsed: Record<string, unknown>, path: string): unknown {
  if (path === "totals.printedNetSalary") {
    const warnings = (parsed.parseMeta as { warnings?: string[] } | undefined)?.warnings ?? [];
    const warning = warnings.find((entry) => entry.startsWith("printed_net_salary:"));
    if (warning) {
      return Number.parseFloat(warning.split(":")[1] ?? "");
    }
  }

  return path.split(".").reduce<unknown>((current, key) => {
    if (current && typeof current === "object" && key in current) {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, parsed);
}

function assertWithinTolerance(
  actual: number,
  expected: number,
  tolerance: number,
  label?: string
) {
  expect(
    Math.abs(actual - expected),
    `${label ?? "assertion"}: actual=${actual} expected=${expected}`
  ).toBeLessThanOrEqual(tolerance);
}

async function runFixtureAssertions(
  plugin: keyof typeof PARSERS,
  fixture: PluginFixture,
  tolerance: number
) {
  const pdfPath = join(ROOT, fixture.pdf);
  if (!(await pathExists(pdfPath))) {
    return { skipped: true as const, reason: `PDF not found: ${fixture.pdf}` };
  }

  const parser = PARSERS[plugin];
  const pdfBytes = await readFile(pdfPath);
  const doc = await extractPdf(pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength));
  const detection = parser.detect(doc);

  expect(detection.confidence).toBeGreaterThanOrEqual(0.8);
  const parsed = parser.parse(doc);
  expect(parsed.vendor.id).toBe(plugin);

  const assertions = (fixture as PluginFixture & { assertions?: Record<string, number> }).assertions;
  if (assertions) {
    for (const [path, expected] of Object.entries(assertions)) {
      const actual = getAssertionValue(parsed as unknown as Record<string, unknown>, path);
      expect(actual, `missing assertion path ${path}`).toBeTypeOf("number");
      assertWithinTolerance(
        actual as number,
        expected,
        tolerance,
        `${plugin}/${fixture.id} ${path}`
      );
    }
  }

  if (fixture.requiredFlags?.length) {
    for (const flag of fixture.requiredFlags) {
      expect(parsed.flags).toContain(flag);
    }
  }

  return { skipped: false as const, parsed };
}

describe("parse contract", () => {
  it("exports hilan and merkava parser plugins", () => {
    expect(hilanParser.id).toBe("hilan");
    expect(merkavaParser.id).toBe("merkava");
    expect(typeof hilanParser.detect).toBe("function");
    expect(typeof hilanParser.parse).toBe("function");
    expect(typeof merkavaParser.detect).toBe("function");
    expect(typeof merkavaParser.parse).toBe("function");
  });

  it("hilan detection rejects merkava-style text", () => {
    const doc = {
      pages: [
        {
          pageNumber: 1,
          width: 100,
          height: 100,
          tokens: [{ text: "DB-105292-073997 edu.gov.il אופק", x: 0, y: 0, width: 1, height: 1 }],
        },
      ],
      pageCount: 1,
      isScanned: false,
    };
    expect(hilanParser.detect(doc).confidence).toBeLessThan(0.3);
  });

  it("merkava detection rejects hilan-style text", () => {
    const doc = {
      pages: [
        {
          pageNumber: 1,
          width: 100,
          height: 100,
          tokens: [
            {
              text: "חילן 001 1160 פרוט התשלומים",
              x: 0,
              y: 0,
              width: 1,
              height: 1,
            },
          ],
        },
      ],
      pageCount: 1,
      isScanned: false,
    };
    expect(merkavaParser.detect(doc).confidence).toBeLessThan(0.3);
  });

  it("fixture assertions when PDFs are present", async () => {
    const manifests = await loadPluginManifests();

    for (const { plugin, manifest } of manifests) {
      for (const fixture of manifest.fixtures) {
        const result = await runFixtureAssertions(
          plugin as keyof typeof PARSERS,
          fixture,
          manifest.amountTolerance
        );

        if (result.skipped) {
          // eslint-disable-next-line no-console -- contract visibility when PDFs are absent
          console.info(`[parse contract] skip ${plugin}/${fixture.id}: ${result.reason}`);
        }
      }
    }
  });
});
