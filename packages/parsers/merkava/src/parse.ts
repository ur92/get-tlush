import type {
  CanonicalPayslip,
  ExtractedPdf,
  LineItem,
  LineItemCategory,
  PayslipFlag,
} from "@tlush/parser-core";
import { ParseError } from "@tlush/parser-core";
import { parseNisAmount } from "@tlush/pdf-extract";
import codes from "./codes.json" with { type: "json" };
import {
  amountsFromRow,
  buildRows,
  findAmountByRowPattern,
  findAmountNearLabel,
  findHeaderSummaryNetPay,
  findRowWithLabel,
  HEBREW_MONTHS,
  rowText,
  type Row,
} from "./utils.js";

type LabelPattern = {
  patterns: string[];
  code: string;
  category: LineItemCategory;
  labelKey?: string;
  explanationKey?: string;
  isImputed?: boolean;
  isOneTime?: boolean;
  sourceRegion?: LineItem["sourceRegion"];
};

const LABEL_PATTERNS = codes.labelPatterns as LabelPattern[];

function parsePeriod(rows: Row[]): { month: number; year: number; label: string } {
  const periodRow =
    rows.find((row) => /תלוש משכורת לחודש/.test(rowText(row))) ??
    rows.find((row) => /לחודש/.test(rowText(row)));
  if (!periodRow) {
    throw new ParseError("Unable to locate Merkava payslip period");
  }

  const text = rowText(periodRow);
  const labelMatch = text.match(/(\d{2})\/(\d{4})/);
  if (labelMatch) {
    return {
      month: Number.parseInt(labelMatch[1], 10),
      year: Number.parseInt(labelMatch[2], 10),
      label: `${labelMatch[1]}/${labelMatch[2]}`,
    };
  }

  const yearMatch = text.match(/\b(20\d{2})\b/);
  const year = yearMatch ? Number.parseInt(yearMatch[1], 10) : 0;
  const monthName = Object.keys(HEBREW_MONTHS).find((name) => text.includes(name));
  const monthFromName = monthName ? HEBREW_MONTHS[monthName] : 0;
  const monthMatch = text.match(/\b(0?[1-9]|1[0-2])\b/);
  const month = monthFromName || (monthMatch ? Number.parseInt(monthMatch[1], 10) : 0);

  if (!month || !year) {
    throw new ParseError("Unable to parse Merkava payslip period");
  }

  return {
    month,
    year,
    label: `${String(month).padStart(2, "0")}/${year}`,
  };
}

function parseLabelRows(rows: Row[]): LineItem[] {
  const items: LineItem[] = [];

  for (const row of rows) {
    const text = rowText(row);
    const mapping = LABEL_PATTERNS.find((entry) =>
      entry.patterns.some((pattern) => text.includes(pattern))
    );
    if (!mapping) {
      continue;
    }

    const amounts = row.tokens
      .map((token) => parseNisAmount(token.text))
      .filter((value): value is number => value !== null);
    if (amounts.length === 0) {
      continue;
    }

    const rawLabel =
      mapping.patterns.find((pattern) => text.includes(pattern)) ?? mapping.patterns[0];

    const item: LineItem = {
      code: mapping.code,
      rawLabel,
      amount: Math.abs(amounts[0]),
      category: mapping.category,
      sourceRegion: mapping.sourceRegion ?? "earnings",
      page: row.page,
      confidence: "high",
    };

    if (mapping.labelKey) item.labelKey = mapping.labelKey;
    if (mapping.explanationKey) item.explanationKey = mapping.explanationKey;
    if (mapping.isImputed) item.isImputed = true;
    if (mapping.isOneTime) item.isOneTime = true;

    if (amounts.length >= 3) {
      item.quantity = amounts[1];
      item.rate = amounts[2];
      item.unit = "hours";
    }

    items.push(item);
  }

  return items;
}

function buildFlags(lines: LineItem[], pageCount: number): PayslipFlag[] {
  const flags = new Set<PayslipFlag>();

  if (lines.some((line) => line.category === "deduction.ni_adjustment")) {
    flags.add("ni_adjustment");
  }
  if (lines.some((line) => line.category === "deduction.health_adjustment")) {
    flags.add("health_adjustment");
  }
  if (lines.some((line) => line.isImputed)) {
    flags.add("imputed_income_present");
  }
  if (lines.some((line) => line.code === "DB-PENSION-HAREL")) {
    flags.add("pension_present");
  }
  if (lines.some((line) => line.code === "DB-KH-INTL")) {
    flags.add("keren_hishtalmut_present");
  }
  if (lines.some((line) => line.category === "unknown")) {
    flags.add("unknown_line_items");
  }
  if (pageCount > 1) {
    flags.add("multi_page_ytd");
  }

  return [...flags];
}

export function parseMerkava(doc: ExtractedPdf): CanonicalPayslip {
  const rows = buildRows(doc);
  const period = parsePeriod(rows);
  const parsedLines = parseLabelRows(rows);

  const earnings = parsedLines.filter(
    (line) =>
      line.category.startsWith("earnings.") ||
      line.category.startsWith("imputed.") ||
      line.category.startsWith("equity.")
  );
  const deductions = parsedLines
    .filter((line) => line.category.startsWith("deduction."))
    .map((line) => ({ ...line, amount: Math.abs(line.amount) }));

  const grossCash =
    findAmountNearLabel(rows, codes.summaryLabels.grossCash) ??
    earnings
      .filter((line) => !line.isImputed && line.category.startsWith("earnings."))
      .reduce((sum, line) => sum + line.amount, 0);

  const netPay =
    findAmountNearLabel(rows, codes.summaryLabels.netPay) ??
    findAmountByRowPattern(rows, /לתשלום\s*נטו|נטו\s*ל(?:תשלום|חשבון)|סכום\s*לתשלום/) ??
    findHeaderSummaryNetPay(rows);
  const taxableGross =
    findAmountNearLabel(rows, codes.summaryLabels.taxableGross) ?? grossCash;

  const incomeTax =
    findAmountNearLabel(rows, ["ניכוי מס הכנסה"]) ??
    deductions.find((line) => line.code === "DB-INCOME-TAX")?.amount ??
    findAmountNearLabel(rows, ["מס הכנסה"]) ??
    0;
  const ni =
    findAmountNearLabel(rows, ['ניכוי ב"ל', "ניכוי ב.ל"]) ??
    deductions.find((line) => line.code === "DB-NI")?.amount ??
    findAmountNearLabel(rows, ["ביטוח לאומי"]) ??
    0;
  const healthTax =
    findAmountNearLabel(rows, ["ניכוי מס בריאות"]) ??
    deductions.find((line) => line.code === "DB-HEALTH")?.amount ??
    findAmountNearLabel(rows, ["דמי בריאות", "ביטוח בריאות"]) ??
    0;

  if (netPay === null) {
    throw new ParseError("Unable to reconcile Merkava net pay");
  }

  const payslipIdPattern = new RegExp(codes.detectionAnchors.payslipIdPattern);
  const payslipIdRow = rows.find((row) => payslipIdPattern.test(rowText(row)));
  const payslipId = payslipIdRow ? rowText(payslipIdRow).match(payslipIdPattern)?.[0] : undefined;

  const creditPointsRow = findRowWithLabel(rows, ["פרוט נקודות זיכוי", "נקודות זיכוי"]);
  const creditPoints = creditPointsRow
    ? (amountsFromRow(creditPointsRow).find((value) => value >= 0 && value <= 20) ??
      amountsFromRow(creditPointsRow).at(-1) ??
      0)
    : 0;

  return {
    vendor: {
      id: "merkava",
      parserVersion: "1.0.0",
      displayNameKey: "vendors.merkava",
    },
    period,
    employer: {
      name: rows.find((row) => rowText(row).includes("משרד החינוך")) ? "משרד החינוך" : undefined,
      payrollId: payslipId,
    },
    earnings,
    deductions,
    totals: {
      grossCash,
      taxableGross,
      netPay,
      incomeTax,
      ni,
      healthTax,
      totalEarnings: grossCash,
      totalDeductions: deductions.reduce((sum, line) => sum + line.amount, 0),
      pensionEmployee: deductions.find((line) => line.code === "DB-PENSION-HAREL")?.amount,
      kerenHishtalmutEmployee: deductions.find((line) => line.code === "DB-KH-INTL")?.amount,
    },
    context: {
      creditPoints,
    },
    flags: buildFlags(parsedLines, doc.pageCount),
    parseMeta: {
      pageCount: doc.pageCount,
      amountTolerance: 0.01,
      warnings: [],
    },
  };
}
