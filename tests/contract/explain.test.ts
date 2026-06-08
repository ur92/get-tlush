import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { explainPayslip, resolveExplanationKey } from "../../packages/explain/src/index.ts";
import { getNestedString, locales } from "../../packages/knowledge/src/index.ts";
import type { CanonicalPayslip } from "../../packages/explain/src/types.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

function loadFixture(path: string): CanonicalPayslip {
  const raw = readFileSync(join(ROOT, path), "utf8");
  return JSON.parse(raw) as CanonicalPayslip;
}

function collectKeys(obj: Record<string, unknown>, prefix = ""): string[] {
  const keys: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") {
      keys.push(path);
    } else if (value && typeof value === "object") {
      keys.push(...collectKeys(value as Record<string, unknown>, path));
    }
  }
  return keys;
}

const heKeys = new Set(collectKeys(locales.he as Record<string, unknown>));

describe("explain contract", () => {
  const fixtures = [
    "specs/plugins/hilan/fixtures/april-2026.json",
    "specs/plugins/hilan/fixtures/may-2026.json",
    "specs/plugins/merkava/fixtures/march-2026-education.json",
  ];

  it.each(fixtures)("every classified line in %s has explanationKey", (fixturePath) => {
    const payslip = loadFixture(fixturePath);
    const result = explainPayslip(payslip);

    for (const item of result.lineItems) {
      if (item.category === "unknown") {
        expect(item.explanationKey).toBe("explain.unknown");
        continue;
      }
      expect(item.explanationKey).toBeTruthy();
      expect(item.text).toBeTruthy();
      expect(heKeys.has(item.explanationKey)).toBe(true);
    }
  });

  it("code 107 maps to explain.equity.rsuVesting", () => {
    const key = resolveExplanationKey("hilan", {
      code: "107",
      rawLabel: "השלמת מילואים הפרש",
      amount: 1000,
      category: "equity.rsu_vesting",
    });
    expect(key.explanationKey).toBe("explain.equity.rsuVesting");
  });

  it("waterfall includes imputed step when imputed income present", () => {
    const payslip = loadFixture("specs/plugins/hilan/fixtures/april-2026.json");
    const result = explainPayslip(payslip);

    expect(result.waterfall.some((s) => s.explanationKey === "waterfall.imputed_income")).toBe(
      true
    );
    expect(
      result.lineItems.some(
        (item) =>
          item.isImputed &&
          item.explanationKey.startsWith("explain.imputed.")
      )
    ).toBe(true);
  });

  it("negative_gross flag produces banner explanation", () => {
    const payslip = loadFixture("specs/plugins/hilan/fixtures/may-2026.json");
    const result = explainPayslip(payslip);

    if (payslip.flags.includes("negative_gross")) {
      expect(
        result.flags.some((f) => f.explanationKey === "flags.negative_gross")
      ).toBe(true);
    }
  });

  it("always appends disclaimer", () => {
    const payslip = loadFixture("specs/plugins/merkava/fixtures/march-2026-education.json");
    const result = explainPayslip(payslip);

    expect(result.disclaimer.explanationKey).toBe("disclaimer.not_tax_advice");
    expect(result.disclaimer.text).toBe(
      getNestedString(locales.he as Record<string, unknown>, "disclaimer.not_tax_advice")
    );
  });

  it("unknown category resolves to explain.unknown", () => {
    const key = resolveExplanationKey("hilan", {
      code: "9999",
      rawLabel: "פריט לא מוכר",
      amount: 100,
      category: "unknown",
    });
    expect(key.explanationKey).toBe("explain.unknown");
    expect(key.unclassified).toBe(true);
  });
});
