export interface LineItem {
  code: string;
  rawLabel: string;
  amount: number;
  category: string;
  explanationKey?: string;
  isImputed?: boolean;
  isOneTime?: boolean;
}

export interface CanonicalPayslip {
  vendor: { id: string; parserVersion: string };
  period: { month: number; year: number; label?: string };
  earnings: LineItem[];
  deductions: LineItem[];
  totals: {
    grossCash: number;
    taxableGross: number;
    netPay: number;
    incomeTax: number;
    ni: number;
    healthTax: number;
    pensionEmployee?: number;
    totalDeductions?: number;
  };
  context: {
    creditPoints: number;
    equity?: {
      hasEquity?: boolean;
      rsuVesting?: number;
      esppDeduction?: number;
    };
  };
  flags: string[];
}

export interface WaterfallStep {
  explanationKey: string;
  amount: number;
  text: string;
}

export interface AnnotatedLineItem extends LineItem {
  explanationKey: string;
  text: string;
}

export interface Insight {
  explanationKey: string;
  text: string;
  severity?: "info" | "warning";
  metadata?: Record<string, string | number>;
}

export interface FlagExplanation {
  flag: string;
  explanationKey: string;
  text: string;
  severity: "info" | "warning" | "error";
}

export interface ExplanationResult {
  waterfall: WaterfallStep[];
  lineItems: AnnotatedLineItem[];
  insights: Insight[];
  flags: FlagExplanation[];
  disclaimer: { explanationKey: string; text: string };
}

export interface ExplainOptions {
  previousPayslip?: CanonicalPayslip;
  calculatorMismatch?: {
    incomeTaxDelta?: number;
    niDelta?: number;
    healthTaxDelta?: number;
  };
}
