import type { CanonicalPayslip } from "@tlush/parser-core";
import { explainPayslip } from "@tlush/explain";
import type { ExplanationResult } from "@tlush/explain";

export type { ExplanationResult, FlagExplanation, Insight, AnnotatedLineItem, WaterfallStep } from "@tlush/explain";

export function buildExplanation(payslip: CanonicalPayslip): ExplanationResult {
  return explainPayslip(payslip as Parameters<typeof explainPayslip>[0]);
}
