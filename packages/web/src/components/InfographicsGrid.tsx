import { useMemo } from "react";
import type { CanonicalPayslip } from "@tlush/parser-core";
import type { ExplanationResult } from "@tlush/explain";
import {
  buildLeaveBalance,
  buildRetirementSavings,
  buildTakeHome,
  buildTaxComposition,
} from "../lib/infographics";
import { LeaveBalance } from "./charts/LeaveBalance";
import { RetirementSavingsChart } from "./charts/RetirementSavings";
import { TakeHomeGauge } from "./charts/TakeHomeGauge";
import { TaxDonut } from "./charts/TaxDonut";

type InfographicsGridProps = {
  payslip: CanonicalPayslip;
  explanation: ExplanationResult;
};

export function InfographicsGrid({ payslip }: InfographicsGridProps) {
  const tax = useMemo(() => buildTaxComposition(payslip.totals), [payslip.totals]);
  const takeHome = useMemo(() => buildTakeHome(payslip.totals), [payslip.totals]);
  const retirement = useMemo(() => buildRetirementSavings(payslip.totals), [payslip.totals]);
  const leave = useMemo(() => buildLeaveBalance(payslip.context.leave), [payslip.context.leave]);

  const charts = [
    takeHome ? <TakeHomeGauge key="take-home" data={takeHome} /> : null,
    tax ? <TaxDonut key="tax" data={tax} /> : null,
    retirement ? <RetirementSavingsChart key="retirement" data={retirement} /> : null,
    leave ? <LeaveBalance key="leave" data={leave} /> : null,
  ].filter(Boolean);

  if (charts.length === 0) {
    return null;
  }

  return <div className="infographics-grid">{charts}</div>;
}
