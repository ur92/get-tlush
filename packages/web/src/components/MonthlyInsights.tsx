import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import type { FlagExplanation } from "@tlush/explain";

type MonthlyInsightsProps = {
  flags: FlagExplanation[];
};

function severityClass(severity: FlagExplanation["severity"]): string {
  if (severity === "error" || severity === "warning") return "monthly-insights__row--warning";
  return "monthly-insights__row--info";
}

function severityIcon(severity: FlagExplanation["severity"]): string {
  if (severity === "error" || severity === "warning") return "!";
  return "i";
}

export function MonthlyInsights({ flags }: MonthlyInsightsProps) {
  const { t } = useTranslation();
  const panelId = useId();
  const [expanded, setExpanded] = useState(flags.length <= 3);

  if (flags.length === 0) {
    return (
      <section className="monthly-insights card" aria-label={t("summary.insights.title")}>
        <h2 className="monthly-insights__title">{t("summary.insights.title")}</h2>
        <p className="monthly-insights__empty">{t("summary.insights.empty")}</p>
      </section>
    );
  }

  return (
    <section className="monthly-insights card" aria-label={t("summary.insights.title")}>
      <button
        type="button"
        className="monthly-insights__toggle"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={() => setExpanded((open) => !open)}
      >
        <span className="monthly-insights__title">{t("summary.insights.title")}</span>
        <span className="monthly-insights__badge" aria-label={t("summary.insights.count", { count: flags.length })}>
          {flags.length}
        </span>
        <span className="monthly-insights__chevron" aria-hidden="true">
          {expanded ? "▾" : "◂"}
        </span>
      </button>

      {expanded ? (
        <ul id={panelId} className="monthly-insights__list">
          {flags.map((flag) => (
            <li
              key={flag.flag}
              className={`monthly-insights__row ${severityClass(flag.severity)}`}
              role={flag.severity === "warning" || flag.severity === "error" ? "alert" : "status"}
            >
              <span className="monthly-insights__icon" aria-hidden="true">
                {severityIcon(flag.severity)}
              </span>
              <p className="monthly-insights__text">{flag.text}</p>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
