import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { explainPayslip, resolveExplanationKey } from "../../packages/explain/src/index.ts";
import { getNestedString, locales } from "../../packages/knowledge/src/index.ts";
import type { CanonicalPayslip } from "../../packages/explain/src/types.ts";
import { loadPluginManifests } from "./load-manifests.ts";

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
  it("every manifest fixture has classified lines with Hebrew explanations", async () => {
    const manifests = await loadPluginManifests();

    for (const { plugin, manifest } of manifests) {
      for (const fixture of manifest.fixtures) {
        const fixturePath = join("specs/plugins", plugin, fixture.expected);
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
      }
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
    const payslip = loadFixture("specs/plugins/hilan/fixtures/may-2026.json");
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

  it("every payslip flag resolves to Hebrew text (no raw keys)", () => {
    const ALL_FLAGS: string[] = [
      "negative_gross",
      "equity_vesting",
      "equity_espp",
      "imputed_income_present",
      "ni_adjustment",
      "health_adjustment",
      "tax_correction",
      "reserve_duty",
      "retroactive_payment",
      "pension_present",
      "keren_hishtalmut_present",
      "tax_validation_mismatch",
      "low_parse_confidence",
      "unknown_line_items",
      "scanned_pdf_rejected",
      "multi_page_ytd",
    ];

    const payslip = {
      vendor: { id: "hilan", parserVersion: "test" },
      period: { month: 4, year: 2026 },
      earnings: [],
      deductions: [],
      totals: { grossCash: 0, taxableGross: 0, netPay: 0, incomeTax: 0, ni: 0, healthTax: 0 },
      context: { creditPoints: 0 },
      flags: ALL_FLAGS,
    } as unknown as CanonicalPayslip;

    const result = explainPayslip(payslip);
    expect(result.flags).toHaveLength(ALL_FLAGS.length);

    for (const f of result.flags) {
      expect(heKeys.has(f.explanationKey), `missing Hebrew string for flag "${f.flag}" (key ${f.explanationKey})`).toBe(true);
      expect(f.text, `flag "${f.flag}" renders raw key`).not.toBe(f.explanationKey);
    }
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
