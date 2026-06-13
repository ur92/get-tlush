import type { CanonicalPayslip } from "@tlush/parser-core";
import type { ExplanationResult } from "@tlush/explain";
import { PENSION_CATEGORIES, TAX_CATEGORIES } from "./breakdown-tabs";

export type SimpleGroupId = "earnings" | "taxes" | "savings" | "other";

export type SimpleGroupDetail = {
  label: string;
  amount: number;
  text: string;
};

export type SimpleGroup = {
  id: SimpleGroupId;
  amount: number;
  tone: "in" | "out";
  details: SimpleGroupDetail[];
};

export type SimpleProportions = {
  net: number;
  taxes: number;
  savings: number;
  other: number;
};

export type SimpleSummary = {
  earned: number;
  net: number;
  groups: SimpleGroup[];
  proportions: SimpleProportions;
};

const EMPLOYEE_SAVINGS_CATEGORIES = new Set([
  "deduction.pension_employee",
  "deduction.keren_hishtalmut_employee",
]);

function isEarningsCategory(category: string): boolean {
  return category.startsWith("earnings.") || category.startsWith("imputed.");
}

function isOtherDeductionCategory(category: string): boolean {
  return (
    (category.startsWith("deduction.") ||
      category.startsWith("equity.") ||
      category === "deduction.advance" ||
      category === "deduction.correction") &&
    !TAX_CATEGORIES.has(category) &&
    !EMPLOYEE_SAVINGS_CATEGORIES.has(category) &&
    !PENSION_CATEGORIES.has(category)
  );
}

function lineItemToDetail(item: { rawLabel: string; amount: number; text: string }): SimpleGroupDetail {
  return { label: item.rawLabel, amount: item.amount, text: item.text };
}

function findLineItemText(
  lineItems: ExplanationResult["lineItems"],
  categories: string[]
): string | undefined {
  const item = lineItems.find((line) => categories.includes(line.category));
  return item?.text;
}

function buildTaxDetails(
  totals: CanonicalPayslip["totals"],
  lineItems: ExplanationResult["lineItems"],
  waterfall: ExplanationResult["waterfall"],
  labels: { income: string; ni: string; health: string }
): SimpleGroupDetail[] {
  const waterfallText = (key: string) => waterfall.find((step) => step.explanationKey === key)?.text ?? "";

  return [
    {
      label: labels.income,
      amount: totals.incomeTax,
      text:
        findLineItemText(lineItems, ["deduction.income_tax"]) ??
        waterfallText("waterfall.income_tax"),
    },
    {
      label: labels.ni,
      amount: totals.ni,
      text:
        findLineItemText(lineItems, ["deduction.national_insurance", "deduction.ni_adjustment"]) ??
        waterfallText("waterfall.ni"),
    },
    {
      label: labels.health,
      amount: totals.healthTax,
      text:
        findLineItemText(lineItems, ["deduction.health_tax", "deduction.health_adjustment"]) ??
        waterfallText("waterfall.health_tax"),
    },
  ].filter((row) => row.amount !== 0);
}

export type BuildSimpleSummaryLabels = {
  tax: { income: string; ni: string; health: string };
};

export function buildSimpleSummary(
  payslip: CanonicalPayslip,
  explanation: ExplanationResult,
  labels: BuildSimpleSummaryLabels
): SimpleSummary {
  const { totals } = payslip;
  const { lineItems, waterfall } = explanation;

  const earned = totals.totalEarnings ?? totals.grossCash;
  const net = totals.netPay;
  const taxesAmount = totals.incomeTax + totals.ni + totals.healthTax;
  const savingsAmount = (totals.pensionEmployee ?? 0) + (totals.kerenHishtalmutEmployee ?? 0);

  const otherFromTotals = (totals.totalDeductions ?? 0) - taxesAmount - savingsAmount;
  const otherReconcile = earned - net - taxesAmount - savingsAmount;
  const otherAmount = otherFromTotals > 0 ? otherFromTotals : Math.max(0, otherReconcile);

  const earningsDetails = lineItems
    .filter((item) => isEarningsCategory(item.category))
    .map(lineItemToDetail);

  const savingsDetails = lineItems
    .filter((item) => EMPLOYEE_SAVINGS_CATEGORIES.has(item.category))
    .map(lineItemToDetail);

  const otherDetails = lineItems
    .filter((item) => isOtherDeductionCategory(item.category))
    .map(lineItemToDetail);

  const groups: SimpleGroup[] = [
    {
      id: "earnings",
      amount: earned,
      tone: "in",
      details: earningsDetails,
    },
    {
      id: "taxes",
      amount: taxesAmount,
      tone: "out",
      details: buildTaxDetails(totals, lineItems, waterfall, labels.tax),
    },
    {
      id: "savings",
      amount: savingsAmount,
      tone: "out",
      details: savingsDetails,
    },
  ];

  if (otherAmount > 0) {
    groups.push({
      id: "other",
      amount: otherAmount,
      tone: "out",
      details: otherDetails,
    });
  }

  const proportions: SimpleProportions = {
    net,
    taxes: taxesAmount,
    savings: savingsAmount,
    other: Math.max(0, earned - net - taxesAmount - savingsAmount),
  };

  return { earned, net, groups, proportions };
}
