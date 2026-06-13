import type { ExtractedPdf } from "@tlush/pdf-extract";
import { parseNisAmount, reverseVisualHebrew, tryCp1255Decode } from "@tlush/pdf-extract";

export const HEBREW_MONTHS: Record<string, number> = {
  ינואר: 1,
  פברואר: 2,
  מרץ: 3,
  אפריל: 4,
  מאי: 5,
  יוני: 6,
  יולי: 7,
  אוגוסט: 8,
  ספטמבר: 9,
  אוקטובר: 10,
  נובמבר: 11,
  דצמבר: 12,
};

export function decodeToken(text: string): string {
  const trimmed = text.trim();
  if (/[\u0590-\u05FF]/.test(trimmed)) {
    return trimmed;
  }
  return reverseVisualHebrew(tryCp1255Decode(trimmed));
}

export type RowToken = { text: string; x: number };
export type Row = { y: number; page: number; tokens: RowToken[] };

export function buildRows(doc: ExtractedPdf, yTolerance = 3): Row[] {
  const buckets = new Map<string, Array<{ text: string; x: number; page: number }>>();

  for (const page of doc.pages) {
    for (const token of page.tokens) {
      const text = decodeToken(token.text);
      if (!text) continue;
      const yKey = Math.round(token.y / yTolerance) * yTolerance;
      const key = `${page.pageNumber}:${yKey}`;
      const bucket = buckets.get(key) ?? [];
      bucket.push({ text, x: token.x, page: page.pageNumber });
      buckets.set(key, bucket);
    }
  }

  return [...buckets.entries()].map(([key, tokens]) => {
    const [page, y] = key.split(":").map(Number);
    return {
      page,
      y,
      tokens: tokens.sort((a, b) => a.x - b.x).map(({ text, x }) => ({ text, x })),
    };
  });
}

export function rowText(row: Row): string {
  const parts = row.tokens.map((token) => token.text);
  const hebrewIndices = parts
    .map((part, index) => (/[\u0590-\u05FF]/.test(part) ? index : -1))
    .filter((index) => index >= 0);

  if (hebrewIndices.length > 1) {
    const hebrewParts = hebrewIndices.map((index) => parts[index]);
    hebrewParts.reverse();
    hebrewIndices.forEach((index, position) => {
      parts[index] = hebrewParts[position];
    });
  }

  return parts.join(" ");
}

export function findRowWithLabel(rows: Row[], labels: string[]): Row | undefined {
  return rows.find((row) => labels.some((label) => rowText(row).includes(label)));
}

export function amountFromRow(row: Row, preferNegative = false): number | null {
  const amounts = row.tokens
    .map((token) => parseNisAmount(token.text))
    .filter((value): value is number => value !== null);

  if (amounts.length === 0) {
    return null;
  }

  if (preferNegative) {
    const negative = amounts.find((value) => value < 0);
    if (negative !== undefined) {
      return negative;
    }
  }

  return amounts[0];
}

export function findAmountNearLabel(
  rows: Row[],
  labels: string[],
  preferNegative = false
): number | null {
  for (const label of labels) {
    const row = findRowWithLabel(rows, [label]);
    const amount = row ? amountFromRow(row, preferNegative) : null;
    if (amount !== null) {
      return amount;
    }
  }

  return null;
}

export function findAmountByRowPattern(
  rows: Row[],
  pattern: RegExp,
  preferNegative = false
): number | null {
  const row = rows.find((entry) => pattern.test(rowText(entry)));
  return row ? amountFromRow(row, preferNegative) : null;
}

export function findLargestAmountByRowPattern(
  rows: Row[],
  pattern: RegExp
): number | null {
  let largest: number | null = null;

  for (const row of rows) {
    if (!pattern.test(rowText(row))) {
      continue;
    }

    for (const amount of amountsFromRow(row)) {
      if (largest === null || amount > largest) {
        largest = amount;
      }
    }
  }

  return largest;
}

/** Hilan PDFs sometimes place summary totals on label-less numeric rows (Synactis export). */
export function findHilanSummaryFallback(rows: Row[]): {
  totalEarnings: number | null;
  netPay: number | null;
  totalDeductions: number | null;
} {
  const summaryBandRows = rows.filter((row) => row.y >= 680 && row.y <= 780);

  const trailingMinusAmounts = summaryBandRows
    .map((row) => {
      const text = rowText(row).trim();
      const amounts = amountsFromRow(row);
      if (amounts.length !== 1 || !/^[\d,.\s]+-\s*$/.test(text)) {
        return null;
      }
      return amounts[0];
    })
    .filter((value): value is number => value !== null);

  const pureAmountRows = summaryBandRows
    .map((row) => {
      const text = rowText(row).trim();
      const amounts = amountsFromRow(row);
      if (amounts.length !== 1 || !/^[\d,.\s]+$/.test(text)) {
        return null;
      }
      return amounts[0];
    })
    .filter((value): value is number => value !== null);

  for (const totalCandidate of [...trailingMinusAmounts].sort((a, b) => b - a)) {
    for (const netCandidate of [...pureAmountRows].sort((a, b) => b - a)) {
      const diff = Number((totalCandidate - netCandidate).toFixed(2));
      if (diff <= 0) {
        continue;
      }
      const hasMatchingDeduction = rows.some((row) =>
        amountsFromRow(row).some((amount) => Math.abs(amount - diff) <= 0.02)
      );
      if (hasMatchingDeduction) {
        return {
          totalEarnings: totalCandidate,
          netPay: netCandidate,
          totalDeductions: diff,
        };
      }
    }
  }

  const netCandidates = pureAmountRows.filter((value) => value > 5000 && value < 500_000);
  const earningsCandidates = trailingMinusAmounts.filter((value) => value > 1000);
  if (netCandidates.length > 0 && earningsCandidates.length > 0) {
    return {
      totalEarnings: Math.min(...earningsCandidates),
      netPay: Math.max(...netCandidates),
      totalDeductions: null,
    };
  }

  return { totalEarnings: null, netPay: null, totalDeductions: null };
}

export function amountsFromRow(row: Row): number[] {
  return row.tokens
    .map((token) => parseNisAmount(token.text))
    .filter((value): value is number => value !== null);
}

export function isCodeToken(text: string): boolean {
  return /^\d{3,4}$/.test(text);
}

export function normalizeLabel(label: string): string {
  return label.replace(/\s+/g, " ").trim();
}
