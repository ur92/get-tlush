import type { ExtractedPdf } from "@tlush/pdf-extract";
import { parseNisAmount } from "@tlush/pdf-extract";

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

export function amountFromRow(row: Row): number | null {
  const amounts = row.tokens
    .map((token) => parseNisAmount(token.text))
    .filter((value): value is number => value !== null);
  return amounts.length > 0 ? amounts[0] : null;
}

export function findAmountNearLabel(rows: Row[], labels: string[]): number | null {
  const row = findRowWithLabel(rows, labels);
  return row ? amountFromRow(row) : null;
}

export function normalizeLabel(label: string): string {
  return label.replace(/\s+/g, " ").trim();
}
