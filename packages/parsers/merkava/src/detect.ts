import type { DetectionResult, ExtractedPdf } from "@tlush/parser-core";
import codes from "./codes.json" with { type: "json" };
import { buildRows, rowText } from "./utils.js";

const HILAN_CODE_PATTERN = /\b(001|002|1160|1660)\b/;
const PAYSLIP_ID = new RegExp(codes.detectionAnchors.payslipIdPattern);

export function detectMerkava(doc: ExtractedPdf): DetectionResult {
  const text = buildRows(doc)
    .map(rowText)
    .join("\n");

  if (/חילן|Hilan/i.test(text) && HILAN_CODE_PATTERN.test(text)) {
    return { confidence: 0.15, signals: ["hilan_negative"] };
  }

  let confidence = 0;
  const signals: string[] = [];

  if (PAYSLIP_ID.test(text)) {
    confidence += 0.35;
    signals.push("payslip_id");
  }

  if (codes.detectionAnchors.domains.some((domain) => text.toLowerCase().includes(domain))) {
    confidence += 0.25;
    signals.push("employer_domain");
  }

  if (codes.detectionAnchors.ofekTerms.some((term) => text.includes(term))) {
    confidence += 0.2;
    signals.push("ofek_marker");
  }

  if (/תלוש משכורת לחודש|משרד החינוך/.test(text)) {
    confidence += 0.15;
    signals.push("header");
  }

  if (/מחנכת|סגנית|שעות הוראה|מקדם משרה/.test(text)) {
    confidence += 0.05;
    signals.push("role_context");
  }

  return {
    confidence: Math.min(confidence, 0.99),
    signals,
  };
}
