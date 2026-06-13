import type { ExtractedPdf } from "@tlush/pdf-extract";
import { parseNisAmount } from "@tlush/pdf-extract";

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

export type RowToken = { text: string; x: number };
export type Row = { y: number; page: number; tokens: RowToken[] };

export function buildRows(doc: ExtractedPdf, yTolerance = 4): Row[] {
  const buckets = new Map<string, Array<{ text: string; x: number; page: number }>>();

  for (const page of doc.pages) {
    for (const token of page.tokens) {
      const text = token.text.trim();
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
  return row.tokens.map((token) => token.text).join(" ");
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

export function amountsFromRow(row: Row): number[] {
  return row.tokens
    .map((token) => parseNisAmount(token.text))
    .filter((value): value is number => value !== null);
}

export function findAmountByRowPattern(
  rows: Row[],
  pattern: RegExp,
  preferNegative = false
): number | null {
  const row = rows.find((entry) => pattern.test(rowText(entry)));
  return row ? amountFromRow(row, preferNegative) : null;
}

/** Education Merkava: page-1 header box prints net without a text label (gross + deductions rows only). */
export function findHeaderSummaryNetPay(rows: Row[]): number | null {
  const headerRows = rows.filter((row) => row.page === 1 && row.y < 60);

  for (const netRow of headerRows) {
    const netAmounts = amountsFromRow(netRow);
    if (netAmounts.length !== 1) {
      continue;
    }

    const netCandidate = netAmounts[0];
    if (netCandidate <= 0) {
      continue;
    }

    for (const summaryRow of headerRows) {
      if (summaryRow === netRow) {
        continue;
      }

      const summaryAmounts = amountsFromRow(summaryRow);
      if (summaryAmounts.length < 2) {
        continue;
      }

      const grossCandidate = Math.max(...summaryAmounts);
      const deductionSum = summaryAmounts
        .filter((amount) => amount !== grossCandidate)
        .reduce((sum, amount) => sum + amount, 0);

      if (Math.abs(grossCandidate - deductionSum - netCandidate) <= 0.02) {
        return netCandidate;
      }
    }
  }

  const standaloneNetRow = headerRows
    .filter((row) => row.y < 30)
    .find((row) => {
      const amounts = amountsFromRow(row);
      return amounts.length === 1 && amounts[0] > 1000;
    });

  if (standaloneNetRow) {
    return amountsFromRow(standaloneNetRow)[0];
  }

  return null;
}

export function findAmountNearLabel(rows: Row[], labels: string[]): number | null {
  const row = findRowWithLabel(rows, labels);
  return row ? amountFromRow(row) : null;
}

export function normalizeLabel(label: string): string {
  return label.replace(/\s+/g, " ").trim();
}
