import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { assertNoPiiKeys } from "@tlush/analytics";

const schemaPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../specs/schemas/anonymized-record.schema.json"
);

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

const schema = JSON.parse(readFileSync(schemaPath, "utf8"));
const validateSchema = ajv.compile(schema);

export type ValidatedRecord = {
  recordId: string;
  recordedAt: string;
  appVersion: string;
  userConsent: true;
  vendorId: string;
  period: { month: number; year: number };
  totals: {
    grossCash: number;
    taxableGross: number;
    netPay: number;
    incomeTax: number;
    ni: number;
    healthTax: number;
    pensionEmployee?: number;
    imputedIncomeTotal?: number;
  };
  categoryCounts: Record<string, number>;
  flags: string[];
  context?: {
    creditPoints?: number;
    hasEquity?: boolean;
    hasYtd?: boolean;
  };
  details?: Record<string, unknown>;
  parseQuality?: Record<string, unknown>;
  validation?: Record<string, unknown>;
  sessionHash?: string;
  parserVersion?: string;
  detectionConfidence?: number;
};

export class RecordValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RecordValidationError";
  }
}

export function validateRecord(body: unknown): ValidatedRecord {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new RecordValidationError("Request body must be a JSON object");
  }

  const record = body as Record<string, unknown>;

  if (record.userConsent !== true) {
    throw new RecordValidationError("userConsent must be true");
  }

  try {
    assertNoPiiKeys(record);
  } catch (error) {
    const message = error instanceof Error ? error.message : "PII deny-list violation";
    throw new RecordValidationError(message);
  }

  if (!validateSchema(record)) {
    const detail = validateSchema.errors?.map((e) => e.message).join("; ") ?? "Invalid record";
    throw new RecordValidationError(detail);
  }

  return record as ValidatedRecord;
}
