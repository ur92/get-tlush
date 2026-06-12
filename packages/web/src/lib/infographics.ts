import type { ContextLeave, Totals } from "@tlush/parser-core";

export type TaxSliceId = "incomeTax" | "ni" | "healthTax";

export type TaxComposition = {
  slices: Array<{ id: TaxSliceId; amount: number }>;
  total: number;
  effectiveRate: number;
  denominator: number;
};

export type TakeHome = {
  net: number;
  earned: number;
  netPct: number;
  arcPct: number;
};

export type RetirementBarGroup = {
  id: "pension" | "keren";
  employee: number;
  employer: number;
};

export type RetirementSavings = {
  groups: RetirementBarGroup[];
  monthlyTotal: number;
};

export type LeaveBalance = {
  vacationBalance: number;
  vacationDays: number;
  sickBalance: number;
  sickDays: number;
};

function clampNonNegative(value: number | undefined): number {
  if (value == null || !Number.isFinite(value)) return 0;
  return Math.max(0, value);
}

function earnedBase(totals: Totals): number {
  const earned = totals.totalEarnings ?? totals.grossCash;
  return clampNonNegative(earned);
}

function taxDenominator(totals: Totals): number {
  const taxable = clampNonNegative(totals.taxableGross);
  if (taxable > 0) return taxable;
  return earnedBase(totals);
}

export function buildTaxComposition(totals: Totals): TaxComposition | null {
  const candidates: Array<{ id: TaxSliceId; amount: number }> = [
    { id: "incomeTax", amount: clampNonNegative(totals.incomeTax) },
    { id: "ni", amount: clampNonNegative(totals.ni) },
    { id: "healthTax", amount: clampNonNegative(totals.healthTax) },
  ];

  const slices = candidates.filter((slice) => slice.amount > 0);
  if (slices.length === 0) return null;

  const total = slices.reduce((sum, slice) => sum + slice.amount, 0);
  const denominator = taxDenominator(totals);
  const effectiveRate = denominator > 0 ? total / denominator : 0;

  return { slices, total, effectiveRate, denominator };
}

export function buildTakeHome(totals: Totals): TakeHome | null {
  const net = clampNonNegative(totals.netPay);
  const earned = earnedBase(totals);

  if (net <= 0 && earned <= 0) return null;

  const netPct = earned > 0 ? (net / earned) * 100 : 0;

  return {
    net,
    earned,
    netPct,
    arcPct: Math.min(netPct, 100),
  };
}

export function buildRetirementSavings(totals: Totals): RetirementSavings | null {
  const pensionEmployee = clampNonNegative(totals.pensionEmployee);
  const pensionEmployer = clampNonNegative(totals.pensionEmployer);
  const kerenEmployee = clampNonNegative(totals.kerenHishtalmutEmployee);
  const kerenEmployer = clampNonNegative(totals.kerenHishtalmutEmployer);

  const groups: RetirementBarGroup[] = [];

  if (pensionEmployee > 0 || pensionEmployer > 0) {
    groups.push({ id: "pension", employee: pensionEmployee, employer: pensionEmployer });
  }

  if (kerenEmployee > 0 || kerenEmployer > 0) {
    groups.push({ id: "keren", employee: kerenEmployee, employer: kerenEmployer });
  }

  if (groups.length === 0) return null;

  const monthlyTotal =
    pensionEmployee + pensionEmployer + kerenEmployee + kerenEmployer;

  return { groups, monthlyTotal };
}

export function buildLeaveBalance(leave: ContextLeave | undefined): LeaveBalance | null {
  if (!leave) return null;

  const vacationBalance = leave.vacationBalance;
  const vacationDays = leave.vacationDays;
  const sickBalance = leave.sickBalance;
  const sickDays = leave.sickDays;

  const hasVacation =
    vacationBalance != null && Number.isFinite(vacationBalance) && vacationBalance >= 0;
  const hasSick = sickBalance != null && Number.isFinite(sickBalance) && sickBalance >= 0;

  if (!hasVacation && !hasSick) return null;

  return {
    vacationBalance: hasVacation ? Math.max(0, vacationBalance!) : 0,
    vacationDays: clampNonNegative(vacationDays),
    sickBalance: hasSick ? Math.max(0, sickBalance!) : 0,
    sickDays: clampNonNegative(sickDays),
  };
}
