import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ResponsiveBar } from "@nivo/bar";
import { formatNis } from "../../lib/format";
import { useChartTheme } from "../../lib/chart-theme";
import type { RetirementSavings } from "../../lib/infographics";

type RetirementSavingsChartProps = {
  data: RetirementSavings;
};

type BarRow = {
  group: string;
  employee: number;
  employer: number;
};

export function RetirementSavingsChart({ data }: RetirementSavingsChartProps) {
  const { t } = useTranslation();
  const { palette, nivoTheme } = useChartTheme();

  const rows = useMemo<BarRow[]>(
    () =>
      data.groups.map((group) => ({
        group: t(`summary.charts.retirement.groups.${group.id}`),
        employee: group.employee,
        employer: group.employer,
      })),
    [data.groups, t]
  );

  const keys = ["employee", "employer"] as const;
  const colors = [palette.savings, palette.income];

  const ariaLabel = t("summary.charts.retirement.aria", {
    total: formatNis(data.monthlyTotal),
  });

  return (
    <div className="chart-card" role="img" aria-label={ariaLabel}>
      <h3 className="chart-card__title">{t("summary.charts.retirement.title")}</h3>
      <div className="chart-card__body chart-card__body--bar">
        <ResponsiveBar<BarRow>
          data={rows}
          keys={[...keys]}
          indexBy="group"
          margin={{ top: 8, right: 8, bottom: 36, left: 8 }}
          padding={0.35}
          groupMode="grouped"
          layout="vertical"
          colors={colors}
          borderRadius={4}
          enableLabel={false}
          axisBottom={{
            tickSize: 0,
            tickPadding: 8,
          }}
          axisLeft={null}
          theme={nivoTheme}
          tooltip={({ id, value, indexValue }) => (
            <div className="chart-tooltip">
              <strong>
                {t(`summary.charts.retirement.series.${String(id)}`)} · {indexValue}
              </strong>
              <span className="chart-tooltip__amount">{formatNis(Number(value))}</span>
            </div>
          )}
        />
      </div>
      <ul className="chart-legend" aria-hidden="true">
        {keys.map((key, index) => (
          <li key={key} className="chart-legend__item">
            <span className="chart-legend__swatch" style={{ background: colors[index] }} />
            <span className="chart-legend__label">{t(`summary.charts.retirement.series.${key}`)}</span>
          </li>
        ))}
      </ul>
      <p className="chart-card__caption">
        {t("summary.charts.retirement.total", { total: formatNis(data.monthlyTotal) })}
      </p>
    </div>
  );
}
