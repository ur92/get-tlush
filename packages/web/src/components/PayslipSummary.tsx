import { useTranslation } from "react-i18next";
import type { CanonicalPayslip } from "@tlush/parser-core";
import { formatNis, formatPeriod } from "../lib/format";

type PayslipSummaryProps = {
  payslip: CanonicalPayslip;
  onContinue: () => void;
};

export function PayslipSummary({ payslip, onContinue }: PayslipSummaryProps) {
  const { t } = useTranslation();
  const vendorKey = `vendors.${payslip.vendor.id}`;

  return (
    <section className="summary-hero">
      <p className="summary-meta">
        {t("summary.period_vendor", {
          period: formatPeriod(payslip.period.month, payslip.period.year),
          vendor: t(vendorKey),
        })}
      </p>
      <div className="summary-card">
        <p className="summary-label">{t("summary.net_to_account")}</p>
        <p className="summary-amount">{formatNis(payslip.totals.netPay)}</p>
        <p className="summary-sub">
          {t("summary.from_gross", { amount: formatNis(payslip.totals.grossCash) })}
        </p>
      </div>
      <button type="button" className="btn btn-primary" onClick={onContinue}>
        {t("summary.continue_breakdown")}
      </button>
    </section>
  );
}
