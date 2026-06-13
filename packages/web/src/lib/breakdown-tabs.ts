import type { AnnotatedLineItem, Insight } from "@tlush/explain";

export type TabId = "fixed_variable" | "taxes" | "pension" | "equity";

export const TAX_CATEGORIES = new Set([
  "deduction.income_tax",
  "deduction.national_insurance",
  "deduction.health_tax",
  "deduction.ni_adjustment",
  "deduction.health_adjustment",
]);

export const PENSION_CATEGORIES = new Set([
  "deduction.pension_employee",
  "deduction.pension_employer",
  "deduction.keren_hishtalmut_employee",
  "deduction.keren_hishtalmut_employer",
  "deduction.gemel",
  "imputed.keren_hishtalmut",
]);

const TAX_INSIGHT_PREFIXES = ["taxes."];

function isEquityCategory(category: string): boolean {
  return category.startsWith("equity.");
}

function isTaxInsight(insight: Insight): boolean {
  return TAX_INSIGHT_PREFIXES.some((prefix) => insight.explanationKey.startsWith(prefix));
}

export function filterLineItemsForTab(
  tabId: TabId,
  lineItems: AnnotatedLineItem[],
  insights: Insight[]
): { items: AnnotatedLineItem[]; insights: Insight[] } {
  switch (tabId) {
    case "fixed_variable": {
      const items = lineItems.filter(
        (item) =>
          item.category.startsWith("earnings.") ||
          item.category.startsWith("imputed.") ||
          item.isOneTime ||
          item.category === "deduction.advance" ||
          item.category === "deduction.correction"
      );
      const tabInsights = insights.filter(
        (i) => i.explanationKey === "insights.variable_item" || i.explanationKey === "insights.month_over_month"
      );
      return { items, insights: tabInsights };
    }
    case "taxes": {
      const items = lineItems.filter((item) => TAX_CATEGORIES.has(item.category));
      const tabInsights = insights.filter(isTaxInsight);
      return { items, insights: tabInsights };
    }
    case "pension": {
      const items = lineItems.filter((item) => PENSION_CATEGORIES.has(item.category));
      return { items, insights: [] };
    }
    case "equity": {
      const items = lineItems.filter((item) => isEquityCategory(item.category));
      const tabInsights = insights.filter(
        (i) => i.explanationKey === "insights.equity_sale_withholding"
      );
      return { items, insights: tabInsights };
    }
  }
}

export function hasEquityLineItems(lineItems: AnnotatedLineItem[]): boolean {
  return lineItems.some((item) => isEquityCategory(item.category));
}

const DEDUCTION_WATERFALL_KEYS = new Set([
  "waterfall.income_tax",
  "waterfall.ni",
  "waterfall.health_tax",
  "waterfall.pension_employee",
  "waterfall.other_deductions",
]);

export function isWaterfallDeduction(explanationKey: string): boolean {
  return DEDUCTION_WATERFALL_KEYS.has(explanationKey);
}

export function isWaterfallNet(explanationKey: string): boolean {
  return explanationKey === "waterfall.net_pay";
}

/** Maps explain-engine waterfall keys to short UI label keys in locales/he.json */
export const WATERFALL_LABEL_KEYS: Record<string, string> = {
  "waterfall.gross_cash": "waterfall.gross_cash",
  "waterfall.imputed_income": "waterfall.imputed_income",
  "waterfall.taxable_gross": "waterfall.taxable_gross",
  "waterfall.income_tax": "waterfall.income_tax",
  "waterfall.ni": "waterfall.ni",
  "waterfall.health_tax": "waterfall.health_tax",
  "waterfall.pension_employee": "waterfall.pension_employee",
  "waterfall.other_deductions": "waterfall.other_deductions",
  "waterfall.net_pay": "waterfall.net_pay",
};
