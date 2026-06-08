import taxRates2026 from "./tax-rates-2026.json" with { type: "json" };
import {
  calculateBituachLeumi,
  calculateBracketedTax,
  calculateEmployerNi,
  calculateIncomeTax,
  calculatePayroll,
  calculatePensionCredit,
} from "./calculate.js";
import {
  PAYSLIP_TOLERANCE_NIS,
  validatePayslipDeductions,
} from "./validate.js";
import type {
  FieldMismatch,
  PayrollInput,
  PayrollResult,
  PayslipTotals,
  PayslipValidationContext,
  PayslipValidationResult,
  TaxRates,
} from "./types.js";

export const defaultTaxRates = taxRates2026 as TaxRates;

export function calculatePayroll2026(input: PayrollInput): PayrollResult {
  return calculatePayroll(defaultTaxRates, input);
}

export {
  calculateBituachLeumi,
  calculateBracketedTax,
  calculateEmployerNi,
  calculateIncomeTax,
  calculatePayroll,
  calculatePensionCredit,
  PAYSLIP_TOLERANCE_NIS,
  validatePayslipDeductions,
};

export type {
  FieldMismatch,
  PayrollInput,
  PayrollResult,
  PayslipTotals,
  PayslipValidationContext,
  PayslipValidationResult,
  TaxRates,
};
