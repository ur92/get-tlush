import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  calculatePayroll,
  calculatePayroll2026,
  defaultTaxRates,
  validatePayslipDeductions,
  type TaxRates,
} from "../../packages/calculator/src/index.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

function loadSpecRates(): TaxRates {
  const raw = readFileSync(
    join(ROOT, "specs/calculator/tax-rates-2026.json"),
    "utf8"
  );
  return JSON.parse(raw) as TaxRates & {
    testVectors: Array<{
      id: string;
      input: Record<string, unknown>;
      expected: Record<string, number>;
    }>;
  };
}

function withinTolerance(
  actual: number,
  expected: number,
  tolerance: number
): boolean {
  return Math.abs(actual - expected) <= tolerance;
}

describe("calculator contract", () => {
  const specRates = loadSpecRates();
  const vectors = (
    specRates as TaxRates & {
      testVectors: Array<{
        id: string;
        description: string;
        input: {
          grossSalary: number;
          creditPoints?: number;
          hasPension?: boolean;
          shoviRechev?: number;
          calcEmployer?: boolean;
        };
        expected: Record<string, number>;
      }>;
    }
  ).testVectors;

  it.each(vectors.map((v) => [v.id, v] as const))(
    "calculatePayroll(%s) matches expected within ±0.01",
    (_id, vector) => {
      const result = calculatePayroll(specRates, vector.input);
      const tolerance = specRates.tolerance ?? 0.01;

      for (const [field, expected] of Object.entries(vector.expected)) {
        const actual = result[field as keyof typeof result];
        expect(
          actual,
          `${field}: expected ${expected}, got ${actual}`
        ).toBeTypeOf("number");
        expect(
          withinTolerance(actual as number, expected, tolerance),
          `${field}: expected ${expected} ±${tolerance}, got ${actual}`
        ).toBe(true);
      }
    }
  );

  it("calculatePayroll2026 uses bundled default rates", () => {
    const result = calculatePayroll2026({
      grossSalary: 20000,
      creditPoints: 2.25,
      hasPension: true,
    });

    expect(result.incomeTax).toBe(2443.85);
    expect(result.netSalary).toBe(14530.69);
  });

  it("shovi rechev increases taxable gross but not pension base", () => {
    const result = calculatePayroll2026({
      grossSalary: 22000,
      shoviRechev: 3500,
      calcEmployer: true,
    });

    expect(result.taxableGross).toBe(25500);
    expect(result.pensionEmployee).toBe(1320);
    expect(result.netSalary).toBe(14020.34);
  });

  it("hasPension=false zeroes pension fields", () => {
    const result = calculatePayroll2026({
      grossSalary: 20000,
      hasPension: false,
    });

    expect(result.pensionEmployee).toBe(0);
    expect(result.pensionCredit).toBe(0);
    expect(result.incomeTax).toBe(2681.5);
  });

  it("NI/health capped at full ceiling for high earners", () => {
    const result = calculatePayroll2026({ grossSalary: 60000 });

    expect(result.bituachLeumi).toBe(3174.6);
    expect(result.healthTax).toBe(2534.31);
  });

  it("pension credit at 9,700 gross salary", () => {
    const result = calculatePayroll2026({ grossSalary: 9700 });
    expect(result.pensionCredit).toBe(203.7);
  });

  it("pension credit at 8,000 gross salary", () => {
    const result = calculatePayroll2026({ grossSalary: 8000 });
    expect(result.pensionCredit).toBe(168);
  });

  it("validatePayslipDeductions accepts matching totals within ±5 NIS", () => {
    const calculated = calculatePayroll2026({
      grossSalary: 20000,
      creditPoints: 2.25,
      hasPension: true,
    });

    const validation = validatePayslipDeductions(
      defaultTaxRates,
      {
        grossCash: 20000,
        taxableGross: 20000,
        incomeTax: calculated.incomeTax,
        ni: calculated.bituachLeumi,
        healthTax: calculated.healthTax,
        pensionEmployee: calculated.pensionEmployee,
      },
      { creditPoints: 2.25, hasPension: true }
    );

    expect(validation.ok).toBe(true);
    expect(validation.flags).toEqual([]);
    expect(validation.mismatches).toHaveLength(0);
  });

  it("validatePayslipDeductions flags mismatch beyond ±5 NIS", () => {
    const validation = validatePayslipDeductions(
      defaultTaxRates,
      {
        grossCash: 20000,
        taxableGross: 20000,
        incomeTax: 3000,
        ni: 940.9,
        healthTax: 884.56,
        pensionEmployee: 1200,
      },
      { creditPoints: 2.25, hasPension: true }
    );

    expect(validation.ok).toBe(false);
    expect(validation.flags).toContain("tax_validation_mismatch");
    expect(validation.mismatches.some((m) => m.field === "incomeTax")).toBe(
      true
    );
  });
});
