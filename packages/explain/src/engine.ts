import { sharedKnowledge, t } from "@tlush/knowledge";
import { resolveExplanationKey } from "./resolve.js";
import type {
  AnnotatedLineItem,
  CanonicalPayslip,
  ExplainOptions,
  ExplanationResult,
  FlagExplanation,
  Insight,
  LineItem,
  WaterfallStep,
} from "./types.js";

const STATUTORY_CATEGORIES = new Set([
  "deduction.income_tax",
  "deduction.national_insurance",
  "deduction.health_tax",
  "deduction.pension_employee",
]);

function sumImputedIncome(items: LineItem[]): number {
  return items
    .filter(
      (item) =>
        item.isImputed ||
        item.category.startsWith("imputed.") ||
        item.category === "equity.capital_gain_value" ||
        item.category === "equity.ordinary_income_value"
    )
    .reduce((sum, item) => sum + Math.abs(item.amount), 0);
}

function sumVoluntaryDeductions(payslip: CanonicalPayslip): number {
  return payslip.deductions
    .filter((item) => !STATUTORY_CATEGORIES.has(item.category))
    .reduce((sum, item) => sum + Math.abs(item.amount), 0);
}

function buildWaterfall(payslip: CanonicalPayslip): WaterfallStep[] {
  const { totals, period } = payslip;
  const imputed = sumImputedIncome([...payslip.earnings, ...payslip.deductions]);
  const otherDeductions = sumVoluntaryDeductions(payslip);
  const periodLabel = period.label ?? `${period.month}/${period.year}`;

  const steps: Array<{ key: string; amount: number } | null> = [
    { key: sharedKnowledge.waterfall.grossCash, amount: totals.grossCash },
    imputed > 0
      ? { key: sharedKnowledge.waterfall.imputedIncome, amount: imputed }
      : null,
    { key: sharedKnowledge.waterfall.taxableGross, amount: totals.taxableGross },
    totals.incomeTax > 0
      ? { key: sharedKnowledge.waterfall.incomeTax, amount: totals.incomeTax }
      : null,
    totals.ni > 0
      ? { key: sharedKnowledge.waterfall.ni, amount: totals.ni }
      : null,
    totals.healthTax > 0
      ? { key: sharedKnowledge.waterfall.healthTax, amount: totals.healthTax }
      : null,
    totals.pensionEmployee && totals.pensionEmployee > 0
      ? {
          key: sharedKnowledge.waterfall.pensionEmployee,
          amount: totals.pensionEmployee,
        }
      : null,
    otherDeductions > 0
      ? {
          key: sharedKnowledge.waterfall.otherDeductions,
          amount: otherDeductions,
        }
      : null,
    { key: sharedKnowledge.waterfall.netPay, amount: totals.netPay },
  ];

  return steps
    .filter((step): step is { key: string; amount: number } => step !== null)
    .map((step) => ({
      explanationKey: step.key,
      amount: step.amount,
      text: t(step.key, { amount: step.amount, period: periodLabel }),
    }));
}

function annotateLineItems(
  vendorId: string,
  items: LineItem[]
): AnnotatedLineItem[] {
  return items.map((item) => {
    const { explanationKey } = resolveExplanationKey(vendorId, item);
    return {
      ...item,
      explanationKey,
      text: t(explanationKey, { amount: Math.abs(item.amount) }),
    };
  });
}

function buildTaxInsights(payslip: CanonicalPayslip): Insight[] {
  const insights: Insight[] = [];
  const { totals, context } = payslip;

  if (totals.incomeTax > 0) {
    insights.push({
      explanationKey: sharedKnowledge.taxes.incomeTax,
      text: t(sharedKnowledge.taxes.incomeTax),
    });
  }

  if (context.creditPoints > 0) {
    const creditAmount = context.creditPoints * 242;
    insights.push({
      explanationKey: sharedKnowledge.taxes.creditPoints,
      text: t(sharedKnowledge.taxes.creditPoints, {
        creditPoints: context.creditPoints,
        amount: creditAmount,
      }),
      metadata: { creditPoints: context.creditPoints },
    });
  }

  if (totals.pensionEmployee && totals.pensionEmployee > 0) {
    const pensionCredit = Math.min(totals.pensionEmployee, 679) * 0.35;
    insights.push({
      explanationKey: sharedKnowledge.taxes.pensionCredit,
      text: t(sharedKnowledge.taxes.pensionCredit, {
        amount: Math.round(pensionCredit * 100) / 100,
      }),
    });
  }

  if (totals.ni > 0) {
    insights.push({
      explanationKey: sharedKnowledge.taxes.ni,
      text: t(sharedKnowledge.taxes.ni, { ceiling: 51910 }),
    });
  }

  if (totals.healthTax > 0) {
    insights.push({
      explanationKey: sharedKnowledge.taxes.health,
      text: t(sharedKnowledge.taxes.health),
    });
  }

  return insights;
}

function buildEquityInsights(payslip: CanonicalPayslip): Insight[] {
  const insights: Insight[] = [];
  const allItems = [...payslip.earnings, ...payslip.deductions];

  const rsuSaleTax = allItems.find(
    (item) => item.category === "equity.rsu_sale_tax"
  );
  if (rsuSaleTax) {
    insights.push({
      explanationKey: "insights.equity_sale_withholding",
      text: t("insights.equity_sale_withholding", {
        amount: Math.abs(rsuSaleTax.amount),
      }),
      severity: "info",
    });
  }

  return insights;
}

function buildVariableInsights(payslip: CanonicalPayslip): Insight[] {
  const variableCategories = new Set([
    "earnings.bonus",
    "earnings.economic_adjustment",
    "earnings.reserve_duty",
    "deduction.advance",
    "deduction.correction",
  ]);

  return [...payslip.earnings, ...payslip.deductions]
    .filter(
      (item) => item.isOneTime || variableCategories.has(item.category)
    )
    .map((item) => {
      const { explanationKey } = resolveExplanationKey(
        payslip.vendor.id,
        item
      );
      return {
        explanationKey: "insights.variable_item",
        text: t("insights.variable_item", {
          label: item.rawLabel,
          amount: item.amount,
        }),
        metadata: { lineKey: explanationKey },
      };
    });
}

function buildFlagExplanations(
  payslip: CanonicalPayslip,
  options: ExplainOptions
): FlagExplanation[] {
  return payslip.flags.map((flag) => {
    const explanationKey =
      sharedKnowledge.flags[flag] ?? `flags.${flag}`;
    let text = t(explanationKey);

    if (
      flag === "tax_validation_mismatch" &&
      options.calculatorMismatch
    ) {
      text = t(sharedKnowledge.taxes.mismatch, {
        incomeTaxDelta: options.calculatorMismatch.incomeTaxDelta ?? 0,
        niDelta: options.calculatorMismatch.niDelta ?? 0,
      });
    }

    const severity: FlagExplanation["severity"] =
      flag === "negative_gross" || flag === "tax_validation_mismatch"
        ? "warning"
        : "info";

    return { flag, explanationKey, text, severity };
  });
}

function buildMonthOverMonthInsights(
  payslip: CanonicalPayslip,
  previous?: CanonicalPayslip
): Insight[] {
  if (!previous) {
    return [];
  }

  const prevByCode = new Map(
    [...previous.earnings, ...previous.deductions].map((item) => [
      item.code,
      item,
    ])
  );

  const insights: Insight[] = [];
  for (const item of [...payslip.earnings, ...payslip.deductions]) {
    const prev = prevByCode.get(item.code);
    if (prev && Math.abs(prev.amount - item.amount) > 0.01) {
      const { explanationKey } = resolveExplanationKey(
        payslip.vendor.id,
        item
      );
      insights.push({
        explanationKey: "insights.month_over_month",
        text: t("insights.month_over_month", {
          label: item.rawLabel,
          amount: item.amount - prev.amount,
        }),
        metadata: { lineKey: explanationKey },
      });
    }
  }

  return insights;
}

export function explainPayslip(
  payslip: CanonicalPayslip,
  options: ExplainOptions = {}
): ExplanationResult {
  const vendorId = payslip.vendor.id;
  const earnings = annotateLineItems(vendorId, payslip.earnings);
  const deductions = annotateLineItems(vendorId, payslip.deductions);

  const insights = [
    ...buildTaxInsights(payslip),
    ...buildEquityInsights(payslip),
    ...buildVariableInsights(payslip),
    ...buildMonthOverMonthInsights(payslip, options.previousPayslip),
  ];

  if (
    payslip.flags.includes("tax_validation_mismatch") &&
    options.calculatorMismatch
  ) {
    insights.push({
      explanationKey: sharedKnowledge.taxes.mismatch,
      text: t(sharedKnowledge.taxes.mismatch, {
        incomeTaxDelta: options.calculatorMismatch.incomeTaxDelta ?? 0,
        niDelta: options.calculatorMismatch.niDelta ?? 0,
      }),
      severity: "warning",
    });
  }

  return {
    waterfall: buildWaterfall(payslip),
    lineItems: [...earnings, ...deductions],
    insights,
    flags: buildFlagExplanations(payslip, options),
    disclaimer: {
      explanationKey: "disclaimer.not_tax_advice",
      text: t("disclaimer.not_tax_advice"),
    },
  };
}
