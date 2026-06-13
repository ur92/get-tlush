import { computeCoreHash, deriveContributorToken } from "./contributor-token.js";
import { recordToRow, type ObservationStore } from "./store.js";
import { JwtValidationError, validateGoogleJwt } from "./validate-jwt.js";
import { RecordValidationError, validateRecord } from "./validate-record.js";

export const MAX_BODY_BYTES = 8 * 1024;

export type IngestEnv = {
  contributorTokenSecret: string;
  googleClientId: string;
};

export type IngestRequest = {
  method: string;
  path: string;
  headers: Record<string, string | undefined>;
  body: string;
  bodyByteLength: number;
};

export type IngestResponse = {
  statusCode: number;
  body?: string;
  headers?: Record<string, string>;
};

export type IngestDeps = {
  validateJwt: typeof validateGoogleJwt;
  store: ObservationStore;
};

function jsonResponse(statusCode: number, payload: Record<string, string>): IngestResponse {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  };
}

function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader) return null;
  const match = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
  return match?.[1]?.trim() ?? null;
}

export async function handleIngest(
  req: IngestRequest,
  env: IngestEnv,
  deps: IngestDeps
): Promise<IngestResponse> {
  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  if (req.bodyByteLength > MAX_BODY_BYTES) {
    return jsonResponse(413, { error: "Payload too large" });
  }

  const token = extractBearerToken(req.headers.authorization ?? req.headers.Authorization);
  if (!token) {
    return jsonResponse(401, { error: "Missing Bearer token" });
  }

  let googleSub: string;
  try {
    ({ sub: googleSub } = await deps.validateJwt(token, env.googleClientId));
  } catch (error) {
    if (error instanceof JwtValidationError) {
      return jsonResponse(401, { error: "Invalid token" });
    }
    throw error;
  }

  let record;
  try {
    const parsed: unknown = req.body ? JSON.parse(req.body) : null;
    record = validateRecord(parsed);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return jsonResponse(400, { error: "Invalid JSON" });
    }
    if (error instanceof RecordValidationError) {
      return jsonResponse(400, { error: error.message });
    }
    throw error;
  }

  const contributorToken = deriveContributorToken(env.contributorTokenSecret, googleSub);
  const coreHash = computeCoreHash({
    grossCash: record.totals.grossCash,
    taxableGross: record.totals.taxableGross,
    netPay: record.totals.netPay,
    incomeTax: record.totals.incomeTax,
    ni: record.totals.ni,
    healthTax: record.totals.healthTax,
    vendorId: record.vendorId,
  });

  const row = recordToRow(record, contributorToken, coreHash);
  const result = await deps.store.insert(row);

  if (result === "duplicate") {
    return jsonResponse(409, { error: "Duplicate observation" });
  }

  return jsonResponse(201, { status: "accepted" });
}

export type { ObservationStore } from "./store.js";
export { JwtValidationError, validateGoogleJwt } from "./validate-jwt.js";
export { RecordValidationError, validateRecord } from "./validate-record.js";
export { computeCoreHash, deriveContributorToken } from "./contributor-token.js";
export { createSupabaseStore, recordToRow } from "./store.js";
