export interface TaxBracket {
  ceiling: number | null;
  rate: number;
}

export interface TaxRates {
  year: number;
  currency: string;
  incomeTax: {
    brackets: TaxBracket[];
    creditPointValue: number;
  };
  pensionCredit: {
    rate: number;
    salaryCeiling: number;
    contributionRate: number;
    maxQualifyingContribution: number;
    maxMonthlyCredit: number;
  };
  nationalInsurance: {
    reducedCeiling: number;
    fullCeiling: number;
    employee: {
      reducedNiRate: number;
      fullNiRate: number;
      reducedHealthRate: number;
      fullHealthRate: number;
    };
    employer: {
      reducedNiRate: number;
      fullNiRate: number;
    };
  };
  pension: {
    employeeRate: number;
    employerRate: number;
    severanceRate: number;
  };
  tolerance: number;
}

export interface PayrollInput {
  grossSalary: number;
  creditPoints?: number;
  hasPension?: boolean;
  shoviRechev?: number;
  calcEmployer?: boolean;
}

export interface PayrollResult {
  grossSalary: number;
  shoviRechev: number;
  taxableGross: number;
  incomeTax: number;
  pensionCredit: number;
  bituachLeumi: number;
  healthTax: number;
  pensionEmployee: number;
  netSalary: number;
  employerNi?: number;
  employerPension?: number;
  employerSeverance?: number;
  totalEmployerCost?: number;
}

export interface PayslipTotals {
  grossCash: number;
  taxableGross: number;
  incomeTax: number;
  ni: number;
  healthTax: number;
  pensionEmployee?: number;
}

export interface PayslipValidationContext {
  creditPoints: number;
  hasPension?: boolean;
  imputedIncome?: number;
}

export interface FieldMismatch {
  field: "incomeTax" | "ni" | "healthTax" | "pensionEmployee";
  parsed: number;
  calculated: number;
  delta: number;
}

export interface PayslipValidationResult {
  ok: boolean;
  flags: string[];
  calculated: PayrollResult;
  mismatches: FieldMismatch[];
}
