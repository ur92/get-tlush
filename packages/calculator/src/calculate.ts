import type { PayrollInput, PayrollResult, TaxRates } from "./types.js";

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function calculatePensionCredit(
  rates: TaxRates,
  insuredSalary: number,
  employeeContribution: number
): number {
  const { salaryCeiling, contributionRate, rate } = rates.pensionCredit;
  const cappedSalary = Math.min(insuredSalary, salaryCeiling);
  const maxQualifying = cappedSalary * contributionRate;
  const eligible = Math.min(employeeContribution, maxQualifying);
  return round2(eligible * rate);
}

export function calculateBracketedTax(
  rates: TaxRates,
  taxableMonthly: number
): number {
  let tax = 0;
  let prevCeiling = 0;

  for (const bracket of rates.incomeTax.brackets) {
    const ceiling = bracket.ceiling ?? Number.POSITIVE_INFINITY;
    if (taxableMonthly <= prevCeiling) {
      break;
    }
    const taxable = Math.min(taxableMonthly, ceiling) - prevCeiling;
    tax += taxable * bracket.rate;
    prevCeiling = ceiling;
  }

  return tax;
}

export function calculateIncomeTax(
  rates: TaxRates,
  taxableMonthly: number,
  creditPoints: number,
  pensionCredit: number
): number {
  const tax = calculateBracketedTax(rates, taxableMonthly);
  const creditValue = creditPoints * rates.incomeTax.creditPointValue;
  return round2(Math.max(0, tax - creditValue - pensionCredit));
}

export function calculateBituachLeumi(
  rates: TaxRates,
  taxableMonthly: number
): { bituachLeumi: number; healthTax: number } {
  const { reducedCeiling, fullCeiling, employee } = rates.nationalInsurance;
  const insurable = Math.min(taxableMonthly, fullCeiling);

  const reducedPortion = Math.min(insurable, reducedCeiling);
  let ni = reducedPortion * employee.reducedNiRate;
  let health = reducedPortion * employee.reducedHealthRate;

  if (insurable > reducedCeiling) {
    const fullPortion = insurable - reducedCeiling;
    ni += fullPortion * employee.fullNiRate;
    health += fullPortion * employee.fullHealthRate;
  }

  return {
    bituachLeumi: round2(ni),
    healthTax: round2(health),
  };
}

export function calculateEmployerNi(
  rates: TaxRates,
  taxableMonthly: number
): number {
  const { reducedCeiling, fullCeiling, employer } = rates.nationalInsurance;
  const insurable = Math.min(taxableMonthly, fullCeiling);

  const reducedPortion = Math.min(insurable, reducedCeiling);
  let ni = reducedPortion * employer.reducedNiRate;

  if (insurable > reducedCeiling) {
    const fullPortion = insurable - reducedCeiling;
    ni += fullPortion * employer.fullNiRate;
  }

  return round2(ni);
}

export function calculatePayroll(
  rates: TaxRates,
  input: PayrollInput
): PayrollResult {
  const grossSalary = input.grossSalary;
  const creditPoints = input.creditPoints ?? 2.25;
  const hasPension = input.hasPension ?? true;
  const shoviRechev = input.shoviRechev ?? 0;
  const calcEmployer = input.calcEmployer ?? false;

  const taxableGross = grossSalary + shoviRechev;
  const pensionEmployee = hasPension
    ? round2(grossSalary * rates.pension.employeeRate)
    : 0;

  const pensionCredit = hasPension
    ? calculatePensionCredit(rates, grossSalary, pensionEmployee)
    : 0;

  const incomeTax = calculateIncomeTax(
    rates,
    taxableGross,
    creditPoints,
    pensionCredit
  );
  const { bituachLeumi, healthTax } = calculateBituachLeumi(
    rates,
    taxableGross
  );

  const netSalary = round2(
    grossSalary - incomeTax - bituachLeumi - healthTax - pensionEmployee
  );

  const result: PayrollResult = {
    grossSalary,
    shoviRechev,
    taxableGross,
    incomeTax,
    pensionCredit,
    bituachLeumi,
    healthTax,
    pensionEmployee,
    netSalary,
  };

  if (calcEmployer) {
    const employerNi = calculateEmployerNi(rates, taxableGross);
    const employerPension = hasPension
      ? round2(grossSalary * rates.pension.employerRate)
      : 0;
    const employerSeverance = hasPension
      ? round2(grossSalary * rates.pension.severanceRate)
      : 0;

    result.employerNi = employerNi;
    result.employerPension = employerPension;
    result.employerSeverance = employerSeverance;
    result.totalEmployerCost = round2(
      grossSalary + employerNi + employerPension + employerSeverance
    );
  }

  return result;
}
