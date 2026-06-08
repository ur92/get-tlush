import type { ExtractedPdf } from "@tlush/pdf-extract";

export type { ExtractedPage, ExtractedPdf, PositionedToken } from "@tlush/pdf-extract";

export type VendorId = "hilan" | "merkava" | "unknown";

export type LineItemCategory =
  | "earnings.base_salary"
  | "earnings.travel"
  | "earnings.bonus"
  | "earnings.overtime"
  | "earnings.seniority"
  | "earnings.role_supplement"
  | "earnings.economic_adjustment"
  | "earnings.reserve_duty"
  | "earnings.other"
  | "imputed.company_car"
  | "imputed.keren_hishtalmut"
  | "imputed.meals"
  | "imputed.other"
  | "equity.rsu_vesting"
  | "equity.espp_purchase"
  | "equity.capital_gain_value"
  | "equity.ordinary_income_value"
  | "equity.other"
  | "deduction.income_tax"
  | "deduction.national_insurance"
  | "deduction.health_tax"
  | "deduction.pension_employee"
  | "deduction.pension_employer"
  | "deduction.keren_hishtalmut_employee"
  | "deduction.keren_hishtalmut_employer"
  | "deduction.gemel"
  | "deduction.union"
  | "deduction.loan"
  | "deduction.advance"
  | "deduction.garnishment"
  | "deduction.correction"
  | "deduction.ni_adjustment"
  | "deduction.health_adjustment"
  | "deduction.other"
  | "unknown";

export type LineItemUnit = "hours" | "days" | "percent" | "units" | "months" | "other";

export type LineItemConfidence = "high" | "medium" | "low";

export type LineItemSourceRegion =
  | "earnings"
  | "deductions"
  | "imputed"
  | "funds"
  | "summary"
  | "ytd"
  | "other";

export type LineItem = {
  code: string;
  rawLabel: string;
  amount: number;
  category: LineItemCategory;
  labelKey?: string;
  quantity?: number;
  rate?: number;
  unit?: LineItemUnit;
  explanationKey?: string;
  isImputed?: boolean;
  isOneTime?: boolean;
  confidence?: LineItemConfidence;
  page?: number;
  sourceRegion?: LineItemSourceRegion;
  metadata?: Record<string, string | number | boolean | null>;
};

export type PayslipFlag =
  | "negative_gross"
  | "equity_vesting"
  | "equity_espp"
  | "imputed_income_present"
  | "ni_adjustment"
  | "health_adjustment"
  | "tax_correction"
  | "reserve_duty"
  | "retroactive_payment"
  | "pension_present"
  | "keren_hishtalmut_present"
  | "tax_validation_mismatch"
  | "low_parse_confidence"
  | "unknown_line_items"
  | "scanned_pdf_rejected"
  | "multi_page_ytd";

export type Vendor = {
  id: VendorId;
  parserVersion: string;
  displayNameKey?: string;
  detectionConfidence?: number;
};

export type Period = {
  month: number;
  year: number;
  label?: string;
};

export type Employee = {
  employeeId?: string;
  nationalId?: string;
  name?: string;
  roles?: string[];
  hours?: number;
  seniorityYears?: number;
  grade?: string;
  department?: string;
};

export type Employer = {
  name?: string;
  registrationId?: string;
  payrollId?: string;
};

export type Totals = {
  grossCash: number;
  taxableGross: number;
  netPay: number;
  incomeTax: number;
  ni: number;
  healthTax: number;
  niBase?: number;
  totalEarnings?: number;
  totalDeductions?: number;
  pensionEmployee?: number;
  pensionEmployer?: number;
  kerenHishtalmutEmployee?: number;
  kerenHishtalmutEmployer?: number;
};

export type CreditPointsBreakdown = {
  points: number;
  reasonKey: string;
};

export type ContextEquity = {
  hasEquity?: boolean;
  rsuVesting?: number;
  esppDeduction?: number;
  capitalGainValue?: number;
  ordinaryIncomeValue?: number;
};

export type ContextYtd = {
  grossCash?: number;
  taxableGross?: number;
  incomeTax?: number;
  ni?: number;
  healthTax?: number;
  netPay?: number;
  pensionEmployee?: number;
};

export type ContextLeave = {
  vacationDays?: number;
  vacationBalance?: number;
  sickDays?: number;
  sickBalance?: number;
};

export type Context = {
  creditPoints: number;
  creditPointsBreakdown?: CreditPointsBreakdown[];
  equity?: ContextEquity;
  ytd?: ContextYtd;
  leave?: ContextLeave;
};

export type ParseMeta = {
  pageCount?: number;
  parsedAt?: string;
  warnings?: string[];
  amountTolerance?: number;
};

export type CanonicalPayslip = {
  vendor: Vendor;
  period: Period;
  employee?: Employee;
  employer?: Employer;
  earnings: LineItem[];
  deductions: LineItem[];
  totals: Totals;
  context: Context;
  flags: PayslipFlag[];
  parseMeta?: ParseMeta;
};

export type DetectionResult = {
  confidence: number;
  signals: string[];
};

export interface PayslipParserPlugin {
  readonly id: VendorId;
  readonly version: string;
  readonly displayNameKey: string;
  detect(doc: ExtractedPdf): DetectionResult;
  parse(doc: ExtractedPdf): CanonicalPayslip;
}

export interface ParserRegistry {
  register(plugin: PayslipParserPlugin): void;
  list(): PayslipParserPlugin[];
  detect(doc: ExtractedPdf): { plugin: PayslipParserPlugin; confidence: number } | null;
  parse(doc: ExtractedPdf): CanonicalPayslip;
}
