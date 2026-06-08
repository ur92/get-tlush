import { calculatePayroll } from "./calculate.js";
import type {
  FieldMismatch,
  PayslipTotals,
  PayslipValidationContext,
  PayslipValidationResult,
  TaxRates,
} from "./types.js";

export const PAYSLIP_TOLERANCE_NIS = 5;

function withinTolerance(
  parsed: number,
  calculated: number,
  tolerance: number
): boolean {
  return Math.abs(parsed - calculated) <= tolerance;
}

export function validatePayslipDeductions(
  rates: TaxRates,
  totals: PayslipTotals,
  context: PayslipValidationContext,
  tolerance = PAYSLIP_TOLERANCE_NIS
): PayslipValidationResult {
  const imputedIncome =
    context.imputedIncome ?? totals.taxableGross - totals.grossCash;
  const hasPension =
    context.hasPension ??
    (totals.pensionEmployee !== undefined && totals.pensionEmployee > 0);

  const calculated = calculatePayroll(rates, {
    grossSalary: totals.grossCash,
    creditPoints: context.creditPoints,
    hasPension,
    shoviRechev: Math.max(0, imputedIncome),
  });

  const checks: Array<{
    field: FieldMismatch["field"];
    parsed: number;
    calculated: number;
  }> = [
    {
      field: "incomeTax",
      parsed: totals.incomeTax,
      calculated: calculated.incomeTax,
    },
    {
      field: "ni",
      parsed: totals.ni,
      calculated: calculated.bituachLeumi,
    },
    {
      field: "healthTax",
      parsed: totals.healthTax,
      calculated: calculated.healthTax,
    },
  ];

  if (totals.pensionEmployee !== undefined) {
    checks.push({
      field: "pensionEmployee",
      parsed: totals.pensionEmployee,
      calculated: calculated.pensionEmployee,
    });
  }

  const mismatches: FieldMismatch[] = checks
    .filter(
      (check) => !withinTolerance(check.parsed, check.calculated, tolerance)
    )
    .map((check) => ({
      field: check.field,
      parsed: check.parsed,
      calculated: check.calculated,
      delta: round2(check.parsed - check.calculated),
    }));

  return {
    ok: mismatches.length === 0,
    flags: mismatches.length > 0 ? ["tax_validation_mismatch"] : [],
    calculated,
    mismatches,
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
