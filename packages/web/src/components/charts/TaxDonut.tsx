import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ResponsivePie } from "@nivo/pie";
import { formatNis } from "../../lib/format";
import { useChartTheme } from "../../lib/chart-theme";
import type { TaxComposition, TaxSliceId } from "../../lib/infographics";

type TaxDonutProps = {
  data: TaxComposition;
};

const SLICE_LABEL_KEYS: Record<TaxSliceId, string> = {
  incomeTax: "summary.tax.income",
  ni: "summary.tax.ni",
  healthTax: "summary.tax.health",
};

const SLICE_TONES: Record<TaxSliceId, "taxes" | "ni" | "health"> = {
  incomeTax: "taxes",
  ni: "ni",
  healthTax: "health",
};

type PieDatum = {
  id: string;
  label: string;
  value: number;
  color: string;
};

function CenterMetric({
  centerX,
  centerY,
  total,
  effectiveRate,
  totalLabel,
  rateLabel,
}: {
  centerX: number;
  centerY: number;
  total: number;
  effectiveRate: number;
  totalLabel: string;
  rateLabel: string;
}) {
  const ratePct = (effectiveRate * 100).toFixed(1);

  return (
    <g transform={`translate(${centerX}, ${centerY})`}>
      <text
        textAnchor="middle"
        dominantBaseline="central"
        y={-14}
        style={{ fontSize: 11, fill: "var(--color-muted)" }}
      >
        {totalLabel}
      </text>
      <text
        textAnchor="middle"
        dominantBaseline="central"
        y={6}
        style={{ fontSize: 16, fontWeight: 700, fill: "var(--color-text)" }}
        direction="ltr"
        unicodeBidi="isolate"
      >
        {formatNis(total)}
      </text>
      <text
        textAnchor="middle"
        dominantBaseline="central"
        y={26}
        style={{ fontSize: 11, fill: "var(--color-muted)" }}
        direction="ltr"
        unicodeBidi="isolate"
      >
        {rateLabel.replace("{{rate}}", ratePct)}
      </text>
    </g>
  );
}

export function TaxDonut({ data }: TaxDonutProps) {
  const { t } = useTranslation();
  const { palette, nivoTheme } = useChartTheme();

  const pieData = useMemo<PieDatum[]>(
    () =>
      data.slices.map((slice) => ({
        id: slice.id,
        label: t(SLICE_LABEL_KEYS[slice.id]),
        value: slice.amount,
        color: palette[SLICE_TONES[slice.id]],
      })),
    [data.slices, palette, t]
  );

  const ariaLabel = t("summary.charts.tax_donut.aria", {
    total: formatNis(data.total),
    rate: (data.effectiveRate * 100).toFixed(1),
  });

  return (
    <div className="chart-card" role="img" aria-label={ariaLabel}>
      <h3 className="chart-card__title">{t("summary.charts.tax_donut.title")}</h3>
      <div className="chart-card__body chart-card__body--donut">
        <ResponsivePie<PieDatum>
          data={pieData}
          margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
          innerRadius={0.62}
          padAngle={1.5}
          cornerRadius={4}
          activeOuterRadiusOffset={4}
          colors={{ datum: "data.color" }}
          borderWidth={0}
          enableArcLinkLabels={false}
          enableArcLabels={false}
          theme={nivoTheme}
          layers={[
            "arcs",
            (props) => (
              <CenterMetric
                centerX={props.centerX}
                centerY={props.centerY}
                total={data.total}
                effectiveRate={data.effectiveRate}
                totalLabel={t("summary.charts.tax_donut.total")}
                rateLabel={t("summary.charts.tax_donut.effective_rate")}
              />
            ),
          ]}
          tooltip={({ datum }) => (
            <div className="chart-tooltip">
              <strong>{datum.label}</strong>
              <span className="chart-tooltip__amount">{formatNis(datum.value)}</span>
            </div>
          )}
        />
      </div>
      <ul className="chart-legend" aria-hidden="true">
        {pieData.map((slice) => (
          <li key={slice.id} className="chart-legend__item">
            <span className="chart-legend__swatch" style={{ background: slice.color }} />
            <span className="chart-legend__label">{slice.label}</span>
            <span className="chart-legend__value">{formatNis(slice.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
