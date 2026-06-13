import { useTranslation } from "react-i18next";
import type { WaterfallStep } from "@tlush/explain";
import {
  isWaterfallDeduction,
  isWaterfallNet,
  WATERFALL_LABEL_KEYS,
} from "../lib/breakdown-tabs";
import { formatNis } from "../lib/format";

type NetBreakdownProps = {
  steps: WaterfallStep[];
};

export function NetBreakdown({ steps }: NetBreakdownProps) {
  const { t } = useTranslation();

  return (
    <section className="waterfall" aria-label={t("breakdown.waterfall_title")}>
      {steps.map((step) => {
        const isDeduction = isWaterfallDeduction(step.explanationKey);
        const isNet = isWaterfallNet(step.explanationKey);
        const labelKey = WATERFALL_LABEL_KEYS[step.explanationKey];

        return (
          <div
            key={step.explanationKey}
            className={`waterfall-step${isDeduction ? " waterfall-step--deduction" : ""}${isNet ? " waterfall-step--net" : ""}`}
          >
            <div className="waterfall-step__header">
              <span className="waterfall-step__label">
                {isDeduction ? "− " : ""}
                {labelKey ? t(labelKey) : step.explanationKey}
              </span>
              <span className="waterfall-step__amount">{formatNis(step.amount)}</span>
            </div>
            <p className="waterfall-step__detail">{step.text}</p>
          </div>
        );
      })}
    </section>
  );
}
