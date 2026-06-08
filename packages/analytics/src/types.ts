import type { CanonicalPayslip, LineItem, VendorId } from "@tlush/parser-core";

export type { CanonicalPayslip, LineItem, VendorId };

export type AnonymizedRecord = {
  recordId: string;
  recordedAt: string;
  appVersion: string;
  sessionHash?: string;
  userConsent: true;
  vendorId: VendorId;
  parserVersion?: string;
  detectionConfidence?: number;
  period: { month: number; year: number };
  totals: {
    grossCash: number;
    taxableGross: number;
    netPay: number;
    incomeTax: number;
    ni: number;
    healthTax: number;
    pensionEmployee?: number;
    imputedIncomeTotal?: number;
  };
  context?: {
    creditPoints?: number;
    hasEquity?: boolean;
    hasYtd?: boolean;
  };
  categoryCounts: Record<string, number>;
  flags: string[];
  parseQuality?: {
    earningsLineCount?: number;
    deductionsLineCount?: number;
    unknownLineCount?: number;
    lowConfidenceLineCount?: number;
    pageCount?: number;
  };
};

export type SubmitObservationOptions = {
  termsAccepted: boolean;
  idToken?: string;
  ingestUrl?: string;
};
