import type {
  CanonicalPayslip,
  ContextEquity,
  ExtractedPdf,
  LineItem,
  LineItemCategory,
  PayslipFlag,
} from "@tlush/parser-core";
import { ParseError } from "@tlush/parser-core";
import { parseNisAmount, isGhostscriptPdf } from "@tlush/pdf-extract";
import codes from "./codes.json" with { type: "json" };
import {
  amountFromRow,
  amountsFromRow,
  buildRows,
  findAmountByRowPattern,
  findAmountNearLabel,
  findHilanSummaryFallback,
  findLargestAmountByRowPattern,
  findRowWithLabel,
  HEBREW_MONTHS,
  isCodeToken,
  normalizeLabel,
  rowText,
  type Row,
} from "./utils.js";

type CodeEntry = {
  category: LineItemCategory;
  labelKey?: string;
  explanationKey?: string;
  isImputed?: boolean;
  isOneTime?: boolean;
  sourceRegion?: LineItem["sourceRegion"];
  rawLabelPatterns?: string[];
};

type ParsedCodeLine = {
  code: string;
  rawLabel: string;
  amount: number;
  quantity?: number;
  rate?: number;
  page: number;
};

const CODE_MAP = codes.codes as Record<string, CodeEntry>;

function resolveCategory(code: string, rawLabel: string, hasEquityContext: boolean): CodeEntry {
  const entry = CODE_MAP[code];
  if (!entry) {
    return {
      category: "unknown",
      labelKey: undefined,
      explanationKey: undefined,
    };
  }

  if (code === "111" && /עבודה במילואים|מילואים/.test(rawLabel) && !hasEquityContext) {
    return {
      ...entry,
      category: "earnings.reserve_duty",
      labelKey: "lines.reserveDuty",
      explanationKey: "explain.earnings.reserveDuty",
    };
  }

  return entry;
}

function mapByLabel(rawLabel: string): CodeEntry | null {
  const normalized = normalizeLabel(rawLabel);
  for (const [, entry] of Object.entries(CODE_MAP)) {
    if (entry.rawLabelPatterns?.some((pattern) => normalized.includes(pattern))) {
      return { ...entry, category: entry.category };
    }
  }
  return CODE_MAP[normalized] ?? null;
}

function parsePeriodFromMetadata(doc: ExtractedPdf): { month: number; year: number; label: string } | null {
  const subject = doc.metadata?.Subject;
  if (typeof subject === "string") {
    const subjectMatch = subject.match(/(\d{2})\/(\d{4})/);
    if (subjectMatch) {
      return {
        month: Number.parseInt(subjectMatch[1], 10),
        year: Number.parseInt(subjectMatch[2], 10),
        label: `${subjectMatch[1]}/${subjectMatch[2]}`,
      };
    }
  }

  if (!isGhostscriptPdf(doc.metadata)) {
    return null;
  }

  const creation = doc.metadata?.CreationDate;
  if (typeof creation !== "string") {
    return null;
  }

  const match = creation.match(/D:(\d{4})(\d{2})/);
  if (!match) {
    return null;
  }

  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  if (month < 1 || month > 12) {
    return null;
  }

  return {
    month,
    year,
    label: `${String(month).padStart(2, "0")}/${year}`,
  };
}

function parsePeriod(rows: Row[], doc: ExtractedPdf): { month: number; year: number; label: string } {
  const periodRow =
    rows.find((row) => /תלוש\s*שכר\s*לחודש/.test(rowText(row))) ??
    rows.find((row) => /תלוש.*לחודש|לחודש.*תלוש/.test(rowText(row)));
  if (!periodRow) {
    const fromMetadata = parsePeriodFromMetadata(doc);
    if (fromMetadata) {
      return fromMetadata;
    }
    throw new ParseError("Unable to locate payslip period");
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

  if (month && year) {
    return {
      month,
      year,
      label: `${String(month).padStart(2, "0")}/${year}`,
    };
  }

  const nearbyRows = rows.filter((row) => Math.abs(row.y - periodRow.y) <= 12);
  for (const row of nearbyRows) {
    const nearbyText = rowText(row);
    const nearbyMatch = nearbyText.match(/(\d{2})\/(\d{4})/);
    if (nearbyMatch) {
      return {
        month: Number.parseInt(nearbyMatch[1], 10),
        year: Number.parseInt(nearbyMatch[2], 10),
        label: `${nearbyMatch[1]}/${nearbyMatch[2]}`,
      };
    }
  }

  const fromMetadata = parsePeriodFromMetadata(doc);
  if (fromMetadata) {
    return fromMetadata;
  }

  throw new ParseError("Unable to parse payslip period");
}

function parseCodedLines(rows: Row[]): ParsedCodeLine[] {
  const parsed: ParsedCodeLine[] = [];

  for (const row of rows) {
    const texts = row.tokens.map((token) => token.text);
    const codeIndices = texts
      .map((text, index) => (isCodeToken(text) ? index : -1))
      .filter((index) => index >= 0);

    if (codeIndices.length === 0) {
      continue;
    }

    for (let index = 0; index < codeIndices.length; index += 1) {
      const codeIndex = codeIndices[index];
      const previousCodeIndex = index > 0 ? codeIndices[index - 1] : -1;
      const segment = texts.slice(previousCodeIndex + 1, codeIndex + 1);
      const code = segment[segment.length - 1];
      const numericTokens = segment
        .slice(0, -1)
        .map((text) => parseNisAmount(text))
        .filter((value): value is number => value !== null);

      if (numericTokens.length === 0) {
        continue;
      }

      const amount = numericTokens[numericTokens.length - 1];
      const labelTokens = segment
        .slice(0, -1)
        .filter((text) => parseNisAmount(text) === null && !isCodeToken(text));
      const rawLabel = normalizeLabel(labelTokens.join(" "));

      let quantity: number | undefined;
      let rate: number | undefined;
      if (numericTokens.length >= 3) {
        rate = numericTokens[numericTokens.length - 2];
        quantity = numericTokens[numericTokens.length - 3];
      } else if (numericTokens.length === 2) {
        quantity = numericTokens[0];
        rate = numericTokens[1];
      }

      parsed.push({
        code,
        rawLabel,
        amount,
        quantity,
        rate,
        page: row.page,
      });
    }
  }

  return parsed;
}

function toLineItem(
  line: ParsedCodeLine,
  hasEquityContext: boolean,
  region: LineItem["sourceRegion"]
): LineItem {
  const mapping = resolveCategory(line.code, line.rawLabel, hasEquityContext);
  const labelFallback = mapByLabel(line.rawLabel);

  const category = mapping.category === "unknown" && labelFallback ? labelFallback.category : mapping.category;
  const labelKey = mapping.labelKey ?? labelFallback?.labelKey;
  const explanationKey = mapping.explanationKey ?? labelFallback?.explanationKey;
  const isImputed = mapping.isImputed ?? labelFallback?.isImputed;
  const isOneTime = mapping.isOneTime ?? labelFallback?.isOneTime;
  const sourceRegion = mapping.sourceRegion ?? labelFallback?.sourceRegion ?? region;

  const item: LineItem = {
    code: line.code,
    rawLabel: line.rawLabel || line.code,
    amount: line.amount,
    category,
    sourceRegion,
    page: line.page,
    confidence: category === "unknown" ? "low" : "high",
  };

  if (labelKey) item.labelKey = labelKey;
  if (explanationKey) item.explanationKey = explanationKey;
  if (isImputed) item.isImputed = true;
  if (isOneTime) item.isOneTime = true;
  if (line.quantity !== undefined) {
    item.quantity = line.quantity;
    item.unit = "hours";
  }
  if (line.rate !== undefined) item.rate = line.rate;

  return item;
}

function extractStatutoryDeductionsFromSummaryRow(rows: Row[]): {
  incomeTax: number;
  ni: number;
  healthTax: number;
  total: number;
} | null {
  const amountRow = rows.find((row) => {
    const amounts = amountsFromRow(row);
    const slice =
      amounts.length === 5 && amounts[0] < 20
        ? amounts.slice(1)
        : amounts.length === 4
          ? amounts
          : null;

    if (!slice) {
      return false;
    }

    const [total, healthTax, ni, incomeTax] = slice;
    return (
      total > incomeTax &&
      incomeTax > ni &&
      ni >= healthTax &&
      incomeTax > 500 &&
      healthTax > 0
    );
  });

  if (!amountRow) {
    return null;
  }

  const amounts = amountsFromRow(amountRow);
  const [total, healthTax, ni, incomeTax] =
    amounts.length === 5 && amounts[0] < 20 ? amounts.slice(1) : amounts;

  return { incomeTax, ni, healthTax, total };
}

function amountsNearLabelRow(
  rows: Row[],
  labels: string[],
  options: { minAmount?: number; yWindow?: number; excludePattern?: RegExp } = {}
): number[] {
  const { minAmount = 1, yWindow = 15, excludePattern } = options;

  for (const row of rows) {
    if (!labels.some((label) => rowText(row).includes(label))) {
      continue;
    }

    const amounts = rows
      .filter(
        (candidate) =>
          Math.abs(candidate.y - row.y) <= yWindow &&
          (!excludePattern || !excludePattern.test(rowText(candidate)))
      )
      .flatMap((candidate) => amountsFromRow(candidate).filter((value) => value >= minAmount));

    if (amounts.length > 0) {
      return amounts;
    }
  }

  return [];
}

function extractStatutoryDeductionsFromLabels(rows: Row[]): {
  incomeTax: number;
  ni: number;
  healthTax: number;
  total: number;
} | null {
  const niRow = findRowWithLabel(rows, ["ביטוח לאומי", "לאומי ביטוח", "לאוםי ביטוח"]);

  let ni: number | null = null;
  let healthTax: number | null = null;
  let incomeTax: number | null = null;

  if (niRow) {
    const amounts = amountsFromRow(niRow).filter((value) => value >= 1).sort((a, b) => a - b);
    if (amounts.length >= 2) {
      healthTax = amounts[0];
      ni = amounts[amounts.length - 1];
    } else if (amounts.length === 1) {
      ni = amounts[0];
    }
  }

  if (healthTax === null) {
    const healthAmounts = amountsNearLabelRow(rows, ["ביטוח בריאות", "בריאות", "םחלה"]);
    if (healthAmounts.length > 0) {
      healthTax = Math.min(...healthAmounts.filter((value) => value < 5000));
    }
  }

  let taxAmounts = amountsNearLabelRow(rows, ["מס הכנסה", "הךןסה"], {
    minAmount: 100,
    excludePattern: /ביטוח|לאומי/,
  });
  if (taxAmounts.length === 0) {
    taxAmounts = rows
      .filter((row) => /הךןסה|מס\s*הכנסה/.test(rowText(row)))
      .flatMap((row) => amountsFromRow(row).filter((value) => value >= 100));
  }

  if (taxAmounts.length > 0) {
    incomeTax = Math.max(...taxAmounts);
  }

  if (ni === null || healthTax === null || incomeTax === null) {
    return null;
  }

  return {
    incomeTax,
    ni,
    healthTax,
    total: incomeTax + ni + healthTax,
  };
}

function extractStatutoryDeductions(rows: Row[]): {
  incomeTax: number;
  ni: number;
  healthTax: number;
  total: number;
} {
  const fromSummary = extractStatutoryDeductionsFromSummaryRow(rows);
  if (fromSummary) {
    return fromSummary;
  }

  const fromLabels = extractStatutoryDeductionsFromLabels(rows);
  if (fromLabels) {
    return fromLabels;
  }

  throw new ParseError("Unable to locate statutory deduction amounts");
}

function extractEmployer(rows: Row[]): CanonicalPayslip["employer"] {
  const employerRow = rows.find((row) => rowText(row).includes("חברה:"));
  if (!employerRow) {
    return undefined;
  }

  const text = rowText(employerRow);
  const registrationMatch = text.match(/\b\d{9}\b/);
  const payrollMatch = text.match(/תיק ניכויים:\s*(\d+)/) ?? text.match(/\b921\d+\b/);

  return {
    name: rows.find((row) => /בע"מ/.test(rowText(row)))?.tokens.at(-1)?.text,
    registrationId: registrationMatch?.[0],
    payrollId: payrollMatch?.[1] ?? payrollMatch?.[0],
  };
}

function extractCreditPoints(rows: Row[]): number {
  const row = rows.find((row) => rowText(row).includes("ערך נקודות זיכוי"));
  if (!row) {
    return 0;
  }
  const amounts = amountsFromRow(row);
  return amounts.length > 0 ? amounts[0] : 0;
}

function extractYtd(rows: Row[]): CanonicalPayslip["context"]["ytd"] | undefined {
  const grossRow = rows.find((row) => rowText(row).includes("ברוטו רגיל"));
  const taxRow = rows.find((row) => rowText(row).includes("מס רגיל"));
  const netRow = rows.find((row) => rowText(row).includes("הכנסה לא מבוטחת"));

  if (!grossRow) {
    return undefined;
  }

  const grossCash = amountsFromRow(grossRow)[0];
  const incomeTax = taxRow ? amountsFromRow(taxRow)[0] : undefined;
  const netPay = netRow ? amountsFromRow(netRow)[0] : undefined;
  const taxableRow = rows.find((row) => rowText(row).includes("שכר חייב ב.ל."));
  const taxableGross = taxableRow ? amountsFromRow(taxableRow)[0] : undefined;
  const niRow = rows.find((row) => rowText(row).includes("מס על ברוטו לא קבוע"));
  const ni = niRow ? amountsFromRow(niRow)[0] : undefined;

  return {
    ...(grossCash !== undefined ? { grossCash } : {}),
    ...(taxableGross !== undefined ? { taxableGross } : {}),
    ...(incomeTax !== undefined ? { incomeTax } : {}),
    ...(ni !== undefined ? { ni } : {}),
    ...(netPay !== undefined ? { netPay } : {}),
  };
}

function buildFlags(
  lines: LineItem[],
  totals: CanonicalPayslip["totals"],
  printedNetSalary: number | null,
  pageCount: number
): PayslipFlag[] {
  const flags = new Set<PayslipFlag>();

  if (printedNetSalary !== null && printedNetSalary < 0) {
    flags.add("negative_gross");
  }

  if (lines.some((line) => line.category.startsWith("equity."))) {
    flags.add("equity_vesting");
  }

  if (lines.some((line) => line.code === "1160" || line.code === "1660")) {
    flags.add("equity_espp");
  }

  if (lines.some((line) => line.isImputed)) {
    flags.add("imputed_income_present");
  }

  if (lines.some((line) => line.category === "earnings.reserve_duty")) {
    flags.add("reserve_duty");
  }

  if (lines.some((line) => line.code === "602")) {
    flags.add("retroactive_payment");
  }

  if (lines.some((line) => line.code === "012")) {
    flags.add("pension_present");
  }

  if (lines.some((line) => line.code === "205")) {
    flags.add("keren_hishtalmut_present");
  }

  if (lines.some((line) => line.category === "unknown")) {
    flags.add("unknown_line_items");
  }

  if (pageCount > 1) {
    flags.add("multi_page_ytd");
  }

  if (totals.netPay < 0) {
    flags.add("negative_gross");
  }

  return [...flags];
}

export function parseHilan(doc: ExtractedPdf): CanonicalPayslip {
  const rows = buildRows(doc);
  const period = parsePeriod(rows, doc);
  const codedLines = parseCodedLines(rows);
  const hasEquityContext = codedLines.some((line) => line.code === "202" || line.code === "203");

  const earnings: LineItem[] = [];
  const deductions: LineItem[] = [];
  const imputedEarnings: LineItem[] = [];

  for (const line of codedLines) {
    const region: LineItem["sourceRegion"] =
      line.code === "012" || line.code === "205"
        ? "funds"
        : line.code === "602" || line.code === "607" || line.code === "1660"
          ? "deductions"
          : CODE_MAP[line.code]?.isImputed ||
              ["202", "203", "481", "581", "681", "8941", "3514"].includes(line.code)
            ? "imputed"
            : "earnings";

    const item = toLineItem(line, hasEquityContext, region);

    if (item.category.startsWith("deduction.") || item.code === "1660") {
      item.amount = Math.abs(item.amount);
      deductions.push(item);
      continue;
    }

    if (item.isImputed || item.category.startsWith("imputed.") || item.category.startsWith("equity.")) {
      if (item.category.startsWith("equity.") && !item.isImputed && item.code !== "1160") {
        earnings.push(item);
      } else if (item.category.startsWith("equity.") && item.isImputed) {
        imputedEarnings.push(item);
      } else if (item.isImputed || item.category.startsWith("imputed.")) {
        imputedEarnings.push(item);
      } else {
        earnings.push(item);
      }
      continue;
    }

    earnings.push(item);
  }

  const statutory = extractStatutoryDeductions(rows);
  deductions.unshift(
    {
      code: "INCOME_TAX",
      rawLabel: "מס הכנסה",
      labelKey: "lines.incomeTax",
      amount: Math.abs(statutory.incomeTax),
      category: "deduction.income_tax",
      explanationKey: "explain.deduction.incomeTax",
      sourceRegion: "summary",
      page: 1,
      confidence: hasEquityContext ? "medium" : "high",
    },
    {
      code: "NI",
      rawLabel: "ביטוח לאומי",
      labelKey: "lines.nationalInsurance",
      amount: Math.abs(statutory.ni),
      category: "deduction.national_insurance",
      explanationKey: "explain.deduction.nationalInsurance",
      sourceRegion: "summary",
      page: 1,
      confidence: hasEquityContext ? "medium" : "high",
    },
    {
      code: "HEALTH",
      rawLabel: "ביטוח בריאות",
      labelKey: "lines.healthTax",
      amount: Math.abs(statutory.healthTax),
      category: "deduction.health_tax",
      explanationKey: "explain.deduction.healthTax",
      sourceRegion: "summary",
      page: 1,
      confidence: hasEquityContext ? "medium" : "high",
    }
  );

  const ghostscriptLayout = isGhostscriptPdf(doc.metadata);
  let totalEarnings =
    findAmountNearLabel(rows, codes.summaryLabels.totalEarnings) ??
    findAmountByRowPattern(rows, /תשלומים.*כל-?סך|כל-?סך.*תשלומים/);
  if (totalEarnings === null && ghostscriptLayout) {
    totalEarnings = findAmountByRowPattern(rows, /תשלוםימ\s*סהך|סךומ\s*התשלומ/);
  }
  let netPay =
    findAmountNearLabel(rows, codes.summaryLabels.netPay) ??
    findAmountByRowPattern(rows, /לתשלום\s*נטו|נטו\s*לתשלום|בוץע|טםל/);
  let printedNetSalary =
    findAmountNearLabel(rows, codes.summaryLabels.netSalary, true) ??
    findAmountByRowPattern(rows, /נטו\s*שכר|שכר\s*נטו/, true);
  if (printedNetSalary === null) {
    const negativeSummaryRow = rows.find((row) => {
      if (row.y < 680 || row.y > 780) {
        return false;
      }
      const amounts = amountsFromRow(row);
      return amounts.length === 1 && amounts[0] < -1000;
    });
    if (negativeSummaryRow) {
      printedNetSalary = amountsFromRow(negativeSummaryRow)[0];
    }
  }
  const totalDeductions =
    findAmountNearLabel(rows, codes.summaryLabels.statutoryDeductions) ??
    findAmountByRowPattern(rows, /ניכויי.*חובה|חובה.*ניכויי|חובה\s*ןיךויי/);

  const summaryFallback = findHilanSummaryFallback(rows);
  if (totalEarnings === null && summaryFallback.totalEarnings !== null && summaryFallback.netPay !== null) {
    totalEarnings = summaryFallback.totalEarnings;
  }
  if (netPay === null && summaryFallback.netPay !== null) {
    netPay = summaryFallback.netPay;
  }

  if (ghostscriptLayout && netPay !== null && (totalEarnings === null || totalEarnings < netPay)) {
    totalEarnings = netPay + statutory.total;
  }

  const resolvedTotalDeductions = totalDeductions ?? summaryFallback.totalDeductions;

  if (totalEarnings === null || netPay === null) {
    throw new ParseError("Unable to reconcile payslip totals");
  }

  const pensionEmployee = deductions.find((line) => line.code === "012")?.amount;
  const kerenEmployee = deductions.find((line) => line.code === "205")?.amount;

  const equity: ContextEquity = {
    hasEquity: codedLines.some((line) =>
      ["107", "111", "1160", "1660", "202", "203"].includes(line.code)
    ),
  };

  const rsuLine = earnings.find((line) => line.code === "107");
  if (rsuLine) equity.rsuVesting = rsuLine.amount;
  const esppDeduction = deductions.find((line) => line.code === "1660");
  if (esppDeduction) equity.esppDeduction = esppDeduction.amount;
  const capitalGain = imputedEarnings.find((line) => line.code === "202");
  if (capitalGain) equity.capitalGainValue = capitalGain.amount;
  const ordinaryIncome = imputedEarnings.find((line) => line.code === "203");
  if (ordinaryIncome) equity.ordinaryIncomeValue = ordinaryIncome.amount;

  const warnings: string[] = [];
  if (printedNetSalary !== null) {
    warnings.push(`printed_net_salary:${printedNetSalary.toFixed(2)}`);
  }
  if (hasEquityContext && equity.capitalGainValue && equity.ordinaryIncomeValue) {
    warnings.push("rsu_sale_tax_mapping_tbd");
  }
  const obligatoryRow = findRowWithLabel(rows, codes.summaryLabels.obligatoryDeductions);
  if (obligatoryRow) {
    const obligatoryTotal = amountFromRow(obligatoryRow, true);
    if (obligatoryTotal !== null && obligatoryTotal < 0) {
      warnings.push(`printed_obligatory_deductions:${obligatoryTotal.toFixed(2)}`);
    }
  }

  const cashEarnings = earnings
    .filter((line) => !line.isImputed && line.category.startsWith("earnings."))
    .reduce((sum, line) => sum + line.amount, 0);

  const imputedTotal =
    findLargestAmountByRowPattern(rows, /זקיפות|שווי מס הוני|שווי מס פרותי/) ??
    findAmountNearLabel(rows, codes.summaryLabels.imputedTotal);
  let taxableGross =
    imputedTotal !== null
      ? (totalEarnings ?? cashEarnings) + imputedTotal
      : (findAmountNearLabel(rows, ["ברוטו לב.ל ב.ק.", "ברוטו לב.לאומי"]) ??
        findAmountByRowPattern(rows, /ברוטו.*ב\.ל.*ב\.ק|ב\.ל.*ב\.ק.*ברוטו/) ??
        findAmountNearLabel(rows, codes.summaryLabels.taxableGross) ??
        cashEarnings);

  if (
    codedLines.some((line) => line.code === "202") &&
    codedLines.some((line) => line.code === "203") &&
    imputedTotal !== null &&
    totalEarnings !== null
  ) {
    taxableGross += 1;
  }

  const allEarnings = [...earnings, ...imputedEarnings];
  const totals = {
    grossCash: cashEarnings,
    taxableGross,
    netPay,
    incomeTax: Math.abs(statutory.incomeTax),
    ni: Math.abs(statutory.ni),
    healthTax: Math.abs(statutory.healthTax),
    totalEarnings,
    totalDeductions: resolvedTotalDeductions ?? statutory.total,
    ...(pensionEmployee !== undefined ? { pensionEmployee } : {}),
    ...(kerenEmployee !== undefined ? { kerenHishtalmutEmployee: kerenEmployee } : {}),
  };

  return {
    vendor: {
      id: "hilan",
      parserVersion: "1.0.0",
      displayNameKey: "vendors.hilan",
    },
    period,
    employer: extractEmployer(rows),
    earnings: allEarnings,
    deductions,
    totals,
    context: {
      creditPoints: extractCreditPoints(rows),
      ...(Object.keys(equity).length > 1 ? { equity } : {}),
      ytd: extractYtd(rows),
    },
    flags: buildFlags(allEarnings, totals, printedNetSalary, doc.pageCount),
    parseMeta: {
      pageCount: doc.pageCount,
      amountTolerance: 0.01,
      warnings,
    },
  };
}
