import { useTranslation } from "react-i18next";
import type { WaterfallStep } from "../lib/explain";
import { formatNis } from "../lib/format";

type NetBreakdownProps = {
  steps: WaterfallStep[];
};

export function NetBreakdown({ steps }: NetBreakdownProps) {
  const { t } = useTranslation();

  return (
    <section className="waterfall">
      {steps.map((step) => (
        <div
          key={step.key}
          className={`waterfall-row ${step.isDeduction ? "waterfall-row--deduction" : ""} ${
            step.key === "waterfall.net_pay" ? "waterfall-row--net" : ""
          }`}
        >
          <span className="waterfall-label">
            {step.isDeduction ? "− " : ""}
            {t(step.key)}
          </span>
          <span className="waterfall-amount">{formatNis(step.amount)}</span>
        </div>
      ))}
    </section>
  );
}
