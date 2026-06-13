import { createHmac, createHash } from "node:crypto";

export function deriveContributorToken(secret: string, googleSub: string): string {
  return createHmac("sha256", secret).update(googleSub, "utf8").digest("hex");
}

export function computeCoreHash(input: {
  grossCash: number;
  taxableGross: number;
  netPay: number;
  incomeTax: number;
  ni: number;
  healthTax: number;
  vendorId: string;
}): string {
  const payload = [
    input.vendorId,
    input.grossCash,
    input.taxableGross,
    input.netPay,
    input.incomeTax,
    input.ni,
    input.healthTax,
  ].join("|");
  return createHash("sha256").update(payload, "utf8").digest("hex").slice(0, 32);
}
