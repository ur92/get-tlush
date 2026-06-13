import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { CanonicalPayslip } from "@tlush/parser-core";
import type { ExplanationResult } from "@tlush/explain";
import { ExplainCard } from "./ExplainCard";
import { InfographicsGrid } from "./InfographicsGrid";
import { MonthlyInsights } from "./MonthlyInsights";
import { PayslipFlow } from "./PayslipFlow";
import { buildSimpleSummary, type SimpleGroupId } from "../lib/simple-groups";
import { formatNis, formatPeriod } from "../lib/format";

type PayslipSummaryProps = {
  payslip: CanonicalPayslip;
  explanation: ExplanationResult;
  onContinue: () => void;
};

const GROUP_LABEL_KEYS: Record<SimpleGroupId, string> = {
  earnings: "summary.you_earned",
  taxes: "summary.group.taxes",
  savings: "summary.group.savings",
  other: "summary.group.other",
};

const GROUP_INTRO_KEYS: Record<SimpleGroupId, string> = {
  earnings: "summary.explain.earnings",
  taxes: "summary.explain.taxes",
  savings: "summary.explain.savings",
  other: "summary.explain.other",
};

export function PayslipSummary({ payslip, explanation, onContinue }: PayslipSummaryProps) {
  const { t } = useTranslation();
  const vendorKey = `vendors.${payslip.vendor.id}`;

  const summary = useMemo(
    () =>
      buildSimpleSummary(payslip, explanation, {
        tax: {
          income: t("summary.tax.income"),
          ni: t("summary.tax.ni"),
          health: t("summary.tax.health"),
        },
      }),
    [payslip, explanation, t]
  );

  return (
    <section className="summary-hero">
      <p className="summary-meta">
        {t("summary.period_vendor", {
          period: formatPeriod(payslip.period.month, payslip.period.year),
          vendor: t(vendorKey),
        })}
      </p>

      <div className="summary-card glass-surface--liquid card--elevated">
        <p className="summary-label">{t("summary.net_to_account")}</p>
        <p className="hero-amount">{formatNis(summary.net)}</p>
      </div>

      <PayslipFlow summary={summary} />

      <InfographicsGrid payslip={payslip} explanation={explanation} />

      <p className="summary-intro">{t("summary.intro")}</p>

      <div className="explain-card-list">
        {summary.groups.map((group) => (
          <ExplainCard
            key={group.id}
            id={group.id}
            label={t(GROUP_LABEL_KEYS[group.id])}
            amount={group.amount}
            tone={group.tone}
            intro={t(GROUP_INTRO_KEYS[group.id])}
            details={group.details}
          />
        ))}
      </div>

      <div className="summary-result card">
        <span className="summary-result__label">{t("summary.result")}</span>
        <span className="summary-result__amount">{formatNis(summary.net)}</span>
      </div>

      <MonthlyInsights flags={explanation.flags} />

      <button type="button" className="btn btn-primary" onClick={onContinue}>
        {t("summary.continue_breakdown")}
      </button>
    </section>
  );
}
