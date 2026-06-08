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

function bucketAmount(amount: number, step = 100): string {
  const rounded = Math.round(amount / step) * step;
  return `${rounded}-${rounded + step}`;
}

function buildDetails(payslip: CanonicalPayslip, allLines: LineItem[]): Record<string, number | string | boolean | string[]> {
  const details: Record<string, number | string | boolean | string[]> = {};
  const flags = payslip.flags;
  const equityEvents: string[] = [];

  if (flags.includes("equity_vesting")) {
    equityEvents.push("vesting");
    details.has_rsu_vesting = true;
    const vestingTax = allLines
      .filter((l) => l.category === "equity.rsu_vesting")
      .reduce((s, l) => s + Math.abs(l.amount), 0);
    if (vestingTax > 0) {
      details.rsu_vesting_proceeds_bucket = bucketAmount(vestingTax);
    }
  }
  if (flags.includes("equity_espp")) equityEvents.push("espp");
  if (flags.includes("tax_correction")) equityEvents.push("correction");

  const rsuSaleLines = allLines.filter((l) => l.category === "equity.capital_gain_value");
  if (rsuSaleLines.length > 0) {
    equityEvents.push("sale");
    details.has_rsu_sale = true;
    const proceeds = rsuSaleLines.reduce((s, l) => s + Math.abs(l.amount), 0);
    details.rsu_sale_proceeds_bucket = bucketAmount(proceeds);
  }

  if (payslip.totals.pensionEmployee !== undefined) {
    details.pension_employee = payslip.totals.pensionEmployee;
  }
  if (payslip.context.ytd?.incomeTax !== undefined) {
    details.ytd_income_tax = payslip.context.ytd.incomeTax;
  }
  if (equityEvents.length > 0) {
    details.equity_event_types = equityEvents;
  }

  return details;
}

export function anonymize(payslip: CanonicalPayslip): AnonymizedRecord {
  const allLines = [...payslip.earnings, ...payslip.deductions];
  const imputedIncomeTotal = sumImputed(allLines);
  const details = buildDetails(payslip, allLines);

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
    ...(Object.keys(details).length > 0 ? { details } : {}),
  };

  assertNoPiiKeys(record as unknown as Record<string, unknown>);
  return record;
}
