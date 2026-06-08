import type { DetectionResult, ExtractedPdf } from "@tlush/parser-core";
import codes from "./codes.json" with { type: "json" };
import { buildRows, rowText, type Row } from "./utils.js";

const HILAN_CODE_PATTERN = /\b(001|002|100|107|111|1160|1660|202|203)\b/;
const SUMMARY_ROW_PATTERN =
  /סך-?כל.*תשלומים|תשלומים.*כל-?סך|נטו\s*לתשלום|לתשלום\s*נטו|שכר\s*נטו|נטו\s*שכר/;
const LAYOUT_ROW_PATTERN =
  /פרוט\s*התשלומים|התשלומים\s*פרוט|תלוש\s*שכר\s*לחודש|עובד\s*ומעביד/;

function anyRowMatches(rows: Row[], pattern: RegExp): boolean {
  return rows.some((row) => pattern.test(rowText(row)));
}

export function detectHilan(doc: ExtractedPdf): DetectionResult {
  const rows = buildRows(doc);
  const text = rows.map(rowText).join("\n");

  if (/DB-\d+-\d+/.test(text) || /edu\.gov\.il/i.test(text)) {
    return { confidence: 0.15, signals: ["merkava_negative"] };
  }

  if (/משולב אופק|דרגה באופק|אופק חדש/.test(text)) {
    return { confidence: 0.15, signals: ["merkava_negative"] };
  }

  let confidence = 0;
  const signals: string[] = [];

  if (/חילן|Hilan/i.test(text)) {
    confidence += 0.35;
    signals.push("vendor_name");
  }

  if (anyRowMatches(rows, LAYOUT_ROW_PATTERN)) {
    confidence += 0.25;
    signals.push("layout_anchor");
  }

  if (
    anyRowMatches(rows, SUMMARY_ROW_PATTERN) ||
    codes.summaryLabels.totalEarnings.some((label) => text.includes(label)) ||
    codes.summaryLabels.netPay.some((label) => text.includes(label)) ||
    codes.summaryLabels.netSalary.some((label) => text.includes(label))
  ) {
    confidence += 0.2;
    signals.push("summary_labels");
  }

  if (HILAN_CODE_PATTERN.test(text)) {
    confidence += 0.2;
    signals.push("line_codes");
  }

  return {
    confidence: Math.min(confidence, 0.99),
    signals,
  };
}
