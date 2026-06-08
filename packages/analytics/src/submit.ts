import { anonymize } from "./anonymize.js";
import type { CanonicalPayslip, SubmitObservationOptions } from "./types.js";

export async function submitObservation(
  payslip: CanonicalPayslip,
  options: SubmitObservationOptions
): Promise<void> {
  if (!options.termsAccepted) {
    return;
  }

  const ingestUrl = options.ingestUrl?.trim();
  if (!ingestUrl) {
    return;
  }

  const record = anonymize(payslip);

  await fetch(ingestUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(options.idToken ? { Authorization: `Bearer ${options.idToken}` } : {}),
    },
    body: JSON.stringify(record),
  });
}
