/** Bundled QA payslip served from `packages/web/public/` in Vite dev. */
export const DEV_QA_PAYSLIP_PATH = "/qa-payslip.pdf";

export async function fetchDevQaPayslip(): Promise<File> {
  const res = await fetch(DEV_QA_PAYSLIP_PATH);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${DEV_QA_PAYSLIP_PATH}: ${res.status}`);
  }
  const blob = await res.blob();
  return new File([blob], "qa-payslip.pdf", { type: "application/pdf" });
}
