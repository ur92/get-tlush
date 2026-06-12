import { useTranslation } from "react-i18next";
import { formatNis } from "../../lib/format";
import { useChartTheme } from "../../lib/chart-theme";
import type { TakeHome } from "../../lib/infographics";

type TakeHomeGaugeProps = {
  data: TakeHome;
};

const SIZE = 200;
const STROKE = 14;
const RADIUS = (SIZE - STROKE) / 2;
const CENTER = SIZE / 2;

function describeArc(startAngle: number, endAngle: number): string {
  const start = polarToCartesian(CENTER, CENTER, RADIUS, endAngle);
  const end = polarToCartesian(CENTER, CENTER, RADIUS, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? 0 : 1;

  return [
    "M",
    start.x,
    start.y,
    "A",
    RADIUS,
    RADIUS,
    0,
    largeArc,
    0,
    end.x,
    end.y,
  ].join(" ");
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const angleRad = ((angleDeg - 180) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(angleRad),
    y: cy + r * Math.sin(angleRad),
  };
}

export function TakeHomeGauge({ data }: TakeHomeGaugeProps) {
  const { t } = useTranslation();
  const { palette } = useChartTheme();

  const arcEnd = 180 * (data.arcPct / 100);
  const trackPath = describeArc(0, 180);
  const valuePath = data.arcPct > 0 ? describeArc(0, arcEnd) : "";

  const pctLabel = data.netPct.toFixed(1);
  const ariaLabel = t("summary.charts.take_home.aria", {
    pct: pctLabel,
    net: formatNis(data.net),
  });

  return (
    <div className="chart-card" role="img" aria-label={ariaLabel}>
      <h3 className="chart-card__title">{t("summary.charts.take_home.title")}</h3>
      <div className="chart-card__body chart-card__body--gauge">
        <svg
          className="take-home-gauge"
          viewBox={`0 0 ${SIZE} ${SIZE * 0.62}`}
          width="100%"
          height="auto"
          aria-hidden="true"
        >
          <path
            d={trackPath}
            fill="none"
            stroke="var(--color-border-light)"
            strokeWidth={STROKE}
            strokeLinecap="round"
          />
          {valuePath ? (
            <path
              d={valuePath}
              fill="none"
              stroke={palette.net}
              strokeWidth={STROKE}
              strokeLinecap="round"
            />
          ) : null}
          <text
            x={CENTER}
            y={CENTER - 6}
            textAnchor="middle"
            className="take-home-gauge__pct"
            direction="ltr"
            unicodeBidi="isolate"
          >
            {pctLabel}
            {t("summary.charts.take_home.pct_unit")}
          </text>
          <text
            x={CENTER}
            y={CENTER + 18}
            textAnchor="middle"
            className="take-home-gauge__net"
            direction="ltr"
            unicodeBidi="isolate"
          >
            {formatNis(data.net)}
          </text>
        </svg>
        <p className="chart-card__caption">
          {t("summary.charts.take_home.caption", {
            earned: formatNis(data.earned),
          })}
        </p>
      </div>
    </div>
  );
}
