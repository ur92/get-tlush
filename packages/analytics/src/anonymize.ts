import { assertNoPiiKeys } from "./pii-stripper.js";
import type { AnonymizedRecord, CanonicalPayslip, LineItem } from "./types.js";

const APP_VERSION = "0.0.0";

function countCategories(items: LineItem[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    counts[item.category] = (counts[item.category] ?? 0) + 1;
  }
  return counts;
}

function sumImputed(items: LineItem[]): number {
  return items
    .filter((item) => item.category.startsWith("imputed."))
    .reduce((sum, item) => sum + Math.abs(item.amount), 0);
}

function countUnknown(items: LineItem[]): number {
  return items.filter((item) => item.category === "unknown").length;
}

function countLowConfidence(items: LineItem[]): number {
  return items.filter((item) => item.confidence === "low").length;
}

export function anonymize(payslip: CanonicalPayslip): AnonymizedRecord {
  const allLines = [...payslip.earnings, ...payslip.deductions];
  const imputedIncomeTotal = sumImputed(allLines);

  const record: AnonymizedRecord = {
    recordId: crypto.randomUUID(),
    recordedAt: new Date().toISOString(),
    appVersion: APP_VERSION,
    userConsent: true,
    vendorId: payslip.vendor.id,
    parserVersion: payslip.vendor.parserVersion,
    detectionConfidence: payslip.vendor.detectionConfidence,
    period: {
      month: payslip.period.month,
      year: payslip.period.year,
    },
    totals: {
      grossCash: payslip.totals.grossCash,
      taxableGross: payslip.totals.taxableGross,
      netPay: payslip.totals.netPay,
      incomeTax: payslip.totals.incomeTax,
      ni: payslip.totals.ni,
      healthTax: payslip.totals.healthTax,
      ...(payslip.totals.pensionEmployee !== undefined
        ? { pensionEmployee: payslip.totals.pensionEmployee }
        : {}),
      ...(imputedIncomeTotal > 0 ? { imputedIncomeTotal } : {}),
    },
    context: {
      creditPoints: payslip.context.creditPoints,
      hasEquity: payslip.context.equity?.hasEquity ?? payslip.flags.some((f) =>
        f.startsWith("equity_")
      ),
      hasYtd: payslip.context.ytd !== undefined,
    },
    categoryCounts: countCategories(allLines),
    flags: [...payslip.flags],
    parseQuality: {
      earningsLineCount: payslip.earnings.length,
      deductionsLineCount: payslip.deductions.length,
      unknownLineCount: countUnknown(allLines),
      lowConfidenceLineCount: countLowConfidence(allLines),
      pageCount: payslip.parseMeta?.pageCount,
    },
  };

  assertNoPiiKeys(record as unknown as Record<string, unknown>);
  return record;
}
