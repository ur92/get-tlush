import { isDevNoAuthEnabled } from "@tlush/auth";

/** Post-auth landing route: summary when dev bypass auto-loads the QA payslip. */
export function getAppHomePath(): string {
  return isDevNoAuthEnabled() ? "/app/summary" : "/app/upload";
}
