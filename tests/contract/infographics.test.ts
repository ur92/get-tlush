import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { CanonicalPayslip } from "../../packages/parsers/core/src/types.ts";
import {
  buildLeaveBalance,
  buildRetirementSavings,
  buildTakeHome,
  buildTaxComposition,
} from "../../packages/web/src/lib/infographics.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

function loadFixture(path: string): CanonicalPayslip {
  const raw = readFileSync(join(ROOT, path), "utf8");
  return JSON.parse(raw) as CanonicalPayslip;
}

const EMPTY_PAYSLIP: CanonicalPayslip = {
  vendor: { id: "hilan", parserVersion: "1.0.0" },
  period: { month: 1, year: 2026 },
  earnings: [],
  deductions: [],
  totals: {
    grossCash: 0,
    taxableGross: 0,
    netPay: 0,
    incomeTax: 0,
    ni: 0,
    healthTax: 0,
  },
  context: { creditPoints: 0 },
  flags: [],
};

describe("infographics builders", () => {
  const may2026 = loadFixture("specs/plugins/hilan/fixtures/may-2026.json");

  describe("buildTaxComposition", () => {
    it("returns slices for may-2026 with effective rate on taxableGross", () => {
      const result = buildTaxComposition(may2026.totals);
      expect(result).not.toBeNull();

      const sliceSum = result!.slices.reduce((sum, slice) => sum + slice.amount, 0);
      expect(sliceSum).toBeCloseTo(result!.total, 2);
      expect(result!.total).toBeCloseTo(
        may2026.totals.incomeTax + may2026.totals.ni + may2026.totals.healthTax,
        2
      );
      expect(result!.denominator).toBe(may2026.totals.taxableGross);
      expect(result!.effectiveRate).toBeCloseTo(result!.total / may2026.totals.taxableGross, 6);
      expect(result!.slices.map((s) => s.id)).toEqual(["incomeTax", "ni", "healthTax"]);
    });

    it("returns null when all tax amounts are zero", () => {
      expect(buildTaxComposition(EMPTY_PAYSLIP.totals)).toBeNull();
    });

    it("falls back to totalEarnings when taxableGross <= 0", () => {
      const result = buildTaxComposition({
        ...EMPTY_PAYSLIP.totals,
        grossCash: 10000,
        totalEarnings: 12000,
        taxableGross: 0,
        incomeTax: 1000,
        ni: 200,
        healthTax: 100,
      });
      expect(result).not.toBeNull();
      expect(result!.denominator).toBe(12000);
      expect(result!.effectiveRate).toBeCloseTo(1300 / 12000, 6);
    });
  });

  describe("buildTakeHome", () => {
    it("computes netPct > 100 for equity month may-2026 and clamps arc", () => {
      const result = buildTakeHome(may2026.totals);
      expect(result).not.toBeNull();
      expect(result!.net).toBeCloseTo(may2026.totals.netPay, 2);
      expect(result!.earned).toBeCloseTo(may2026.totals.totalEarnings!, 2);
      expect(result!.netPct).toBeGreaterThan(100);
      expect(result!.arcPct).toBe(100);
    });

    it("returns null when net and earned are both zero", () => {
      expect(buildTakeHome(EMPTY_PAYSLIP.totals)).toBeNull();
    });

    it("handles earned-only edge without divide-by-zero", () => {
      const result = buildTakeHome({
        ...EMPTY_PAYSLIP.totals,
        grossCash: 0,
        totalEarnings: 0,
        netPay: 500,
      });
      expect(result).not.toBeNull();
      expect(result!.netPct).toBe(0);
      expect(result!.arcPct).toBe(0);
    });
  });

  describe("buildRetirementSavings", () => {
    it("returns pension and keren groups for may-2026", () => {
      const result = buildRetirementSavings(may2026.totals);
      expect(result).not.toBeNull();
      expect(result!.groups).toHaveLength(2);
      expect(result!.groups[0]).toMatchObject({
        id: "pension",
        employee: may2026.totals.pensionEmployee,
        employer: may2026.totals.pensionEmployer,
      });
      expect(result!.groups[1]).toMatchObject({
        id: "keren",
        employee: may2026.totals.kerenHishtalmutEmployee,
        employer: may2026.totals.kerenHishtalmutEmployer,
      });
      expect(result!.monthlyTotal).toBeCloseTo(
        may2026.totals.pensionEmployee! +
          may2026.totals.pensionEmployer! +
          may2026.totals.kerenHishtalmutEmployee! +
          may2026.totals.kerenHishtalmutEmployer!,
        2
      );
    });

    it("returns null when all retirement amounts are zero", () => {
      expect(buildRetirementSavings(EMPTY_PAYSLIP.totals)).toBeNull();
    });

    it("clamps negative values to zero", () => {
      const result = buildRetirementSavings({
        ...EMPTY_PAYSLIP.totals,
        pensionEmployee: -100,
        pensionEmployer: 500,
      });
      expect(result).not.toBeNull();
      expect(result!.groups[0].employee).toBe(0);
      expect(result!.groups[0].employer).toBe(500);
    });
  });

  describe("buildLeaveBalance", () => {
    it("parses leave from may-2026 context", () => {
      const result = buildLeaveBalance(may2026.context.leave);
      expect(result).toEqual({
        vacationBalance: 25.33,
        vacationDays: 22,
        sickBalance: 7,
        sickDays: 18,
      });
    });

    it("returns null when leave is absent", () => {
      expect(buildLeaveBalance(undefined)).toBeNull();
    });

    it("returns null when no balances are present", () => {
      expect(buildLeaveBalance({ vacationDays: 2, sickDays: 1 })).toBeNull();
    });
  });
});
