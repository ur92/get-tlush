import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { anonymize } from "../../packages/analytics/src/anonymize.js";
import {
  handleIngest,
  JwtValidationError,
  type IngestDeps,
  type ObservationStore,
} from "../../packages/ingest/src/handler.js";
import type { CanonicalPayslip } from "../../packages/parsers/core/src/types.js";

const root = join(import.meta.dirname, "../..");
const CONTRIBUTOR_SECRET = "contributor-hmac-secret";
const GOOGLE_CLIENT_ID = "test-client-id.apps.googleusercontent.com";

async function loadPayslipFixture(id: string): Promise<CanonicalPayslip> {
  const raw = await readFile(
    join(root, `specs/plugins/hilan/fixtures/${id}.json`),
    "utf8"
  );
  return JSON.parse(raw) as CanonicalPayslip;
}

function baseRequest(body: unknown) {
  const serialized = JSON.stringify(body);
  return {
    method: "POST",
    path: "/.netlify/functions/a",
    headers: { authorization: "Bearer valid.jwt.token" },
    body: serialized,
    bodyByteLength: Buffer.byteLength(serialized, "utf8"),
  };
}

function makeDeps(overrides: Partial<IngestDeps> = {}): IngestDeps {
  const store: ObservationStore = {
    insert: vi.fn(async () => "inserted" as const),
  };
  return {
    validateJwt: vi.fn(async () => ({ sub: "google-sub-123" })),
    store,
    ...overrides,
  };
}

describe("ingest handler contract", () => {
  it("accepts a valid anonymized record → 201", async () => {
    const payslip = await loadPayslipFixture("april-2026");
    const record = anonymize(payslip);
    const deps = makeDeps();

    const response = await handleIngest(baseRequest(record), env(), deps);

    expect(response.statusCode).toBe(201);
    expect(deps.store.insert).toHaveBeenCalledOnce();
    const row = vi.mocked(deps.store.insert).mock.calls[0]![0];
    expect(row.record_id).toBe(record.recordId);
    expect(row.contributor_token).toMatch(/^[a-f0-9]{64}$/);
    expect(row.core_hash).toHaveLength(32);
  });

  it("rejects payload with PII deny-list key → 400", async () => {
    const payslip = await loadPayslipFixture("april-2026");
    const record = anonymize(payslip);
    const deps = makeDeps();

    const response = await handleIngest(
      baseRequest({ ...record, name: "secret" }),
      env(),
      deps
    );

    expect(response.statusCode).toBe(400);
    expect(response.body).toContain("PII");
    expect(deps.store.insert).not.toHaveBeenCalled();
  });

  it("rejects invalid JWT → 401", async () => {
    const payslip = await loadPayslipFixture("april-2026");
    const record = anonymize(payslip);
    const deps = makeDeps({
      validateJwt: vi.fn(async () => {
        throw new JwtValidationError();
      }),
    });

    const response = await handleIngest(baseRequest(record), env(), deps);

    expect(response.statusCode).toBe(401);
    expect(deps.store.insert).not.toHaveBeenCalled();
  });

  it("returns 409 on duplicate contributor+period+hash", async () => {
    const payslip = await loadPayslipFixture("april-2026");
    const record = anonymize(payslip);
    const deps = makeDeps({
      store: { insert: vi.fn(async () => "duplicate" as const) },
    });

    const response = await handleIngest(baseRequest(record), env(), deps);

    expect(response.statusCode).toBe(409);
  });

  it("rejects userConsent !== true → 400", async () => {
    const payslip = await loadPayslipFixture("april-2026");
    const record = { ...anonymize(payslip), userConsent: false as unknown as true };
    const deps = makeDeps();

    const response = await handleIngest(baseRequest(record), env(), deps);

    expect(response.statusCode).toBe(400);
    expect(response.body).toContain("userConsent");
    expect(deps.store.insert).not.toHaveBeenCalled();
  });

  it("rejects body larger than 8KB → 413", async () => {
    const payslip = await loadPayslipFixture("april-2026");
    const record = anonymize(payslip);
    const deps = makeDeps();

    const response = await handleIngest(
      {
        ...baseRequest(record),
        bodyByteLength: 8 * 1024 + 1,
      },
      env(),
      deps
    );

    expect(response.statusCode).toBe(413);
  });
});

function env() {
  return {
    contributorTokenSecret: CONTRIBUTOR_SECRET,
    googleClientId: GOOGLE_CLIENT_ID,
  };
}
