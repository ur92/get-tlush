import type { CanonicalPayslip } from "@tlush/parser-core";

export type WaterfallStep = {
  key: string;
  amount: number;
  isDeduction?: boolean;
};

export type ExplanationResult = {
  waterfall: WaterfallStep[];
  flags: string[];
  hasEquity: boolean;
};

export function buildExplanation(payslip: CanonicalPayslip): ExplanationResult {
  const { totals } = payslip;
  const waterfall: WaterfallStep[] = [
    { key: "waterfall.gross_cash", amount: totals.grossCash },
    { key: "waterfall.income_tax", amount: totals.incomeTax, isDeduction: true },
    { key: "waterfall.ni", amount: totals.ni, isDeduction: true },
    { key: "waterfall.health_tax", amount: totals.healthTax, isDeduction: true },
  ];

  if (totals.pensionEmployee && totals.pensionEmployee > 0) {
    waterfall.push({
      key: "waterfall.pension_employee",
      amount: totals.pensionEmployee,
      isDeduction: true,
    });
  }

  waterfall.push({ key: "waterfall.net_pay", amount: totals.netPay });

  return {
    waterfall,
    flags: payslip.flags,
    hasEquity: payslip.context.equity?.hasEquity ?? false,
  };
}
