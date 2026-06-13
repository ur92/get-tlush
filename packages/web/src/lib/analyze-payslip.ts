import { extractPdf } from "@tlush/pdf-extract";
import type { CanonicalPayslip } from "@tlush/parser-core";
import type { ExplanationResult } from "@tlush/explain";
import { parserRegistry } from "../parsers";
import { buildExplanation } from "./explain";

export type AnalyzePayslipResult = {
  payslip: CanonicalPayslip;
  explanation: ExplanationResult;
};

export async function analyzePayslip(file: File): Promise<AnalyzePayslipResult> {
  const doc = await extractPdf(file);
  const payslip = parserRegistry.parse(doc);
  const explanation = buildExplanation(payslip);
  return { payslip, explanation };
}
