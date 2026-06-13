import { useTranslation } from "react-i18next";
import { useChartTheme } from "../../lib/chart-theme";
import type { LeaveBalance as LeaveBalanceData } from "../../lib/infographics";

type LeaveBalanceProps = {
  data: LeaveBalanceData;
};

const SIZE = 120;
const STROKE = 10;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

type RingProps = {
  label: string;
  balance: number;
  days: number;
  daysLabel: string;
  color: string;
  maxBalance: number;
};

function ProgressRing({ label, balance, days, daysLabel, color, maxBalance }: RingProps) {
  const progress = maxBalance > 0 ? Math.min(balance / maxBalance, 1) : 0;
  const dashOffset = CIRCUMFERENCE * (1 - progress);
  const center = SIZE / 2;

  return (
    <div className="leave-ring">
      <svg className="leave-ring__svg" viewBox={`0 0 ${SIZE} ${SIZE}`} width={SIZE} height={SIZE} aria-hidden="true">
        <circle
          cx={center}
          cy={center}
          r={RADIUS}
          fill="none"
          stroke="var(--color-border-light)"
          strokeWidth={STROKE}
        />
        <circle
          cx={center}
          cy={center}
          r={RADIUS}
          fill="none"
          stroke={color}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${center} ${center})`}
        />
        <text
          x={center}
          y={center - 4}
          textAnchor="middle"
          className="leave-ring__balance"
          direction="ltr"
          unicodeBidi="isolate"
        >
          {balance.toLocaleString("he-IL", { maximumFractionDigits: 2 })}
        </text>
        <text x={center} y={center + 14} textAnchor="middle" className="leave-ring__unit">
          {label}
        </text>
      </svg>
      <p className="leave-ring__days">{daysLabel.replace("{{days}}", String(days))}</p>
    </div>
  );
}

export function LeaveBalance({ data }: LeaveBalanceProps) {
  const { t } = useTranslation();
  const { palette } = useChartTheme();

  const maxBalance = Math.max(data.vacationBalance, data.sickBalance, 1);

  const ariaLabel = t("summary.charts.leave.aria", {
    vacation: data.vacationBalance,
    sick: data.sickBalance,
  });

  return (
    <div className="chart-card" role="img" aria-label={ariaLabel}>
      <h3 className="chart-card__title">{t("summary.charts.leave.title")}</h3>
      <div className="chart-card__body chart-card__body--rings">
        <ProgressRing
          label={t("summary.charts.leave.vacation")}
          balance={data.vacationBalance}
          days={data.vacationDays}
          daysLabel={t("summary.charts.leave.days_accrued")}
          color={palette.income}
          maxBalance={maxBalance}
        />
        <ProgressRing
          label={t("summary.charts.leave.sick")}
          balance={data.sickBalance}
          days={data.sickDays}
          daysLabel={t("summary.charts.leave.days_accrued")}
          color={palette.savings}
          maxBalance={maxBalance}
        />
      </div>
    </div>
  );
}
