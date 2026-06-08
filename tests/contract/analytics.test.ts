import { readFile } from "node:fs/promises";
import { join } from "node:path";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { describe, expect, it } from "vitest";
import { anonymize } from "../../packages/analytics/src/anonymize.js";
import type { CanonicalPayslip } from "../../packages/parsers/core/src/types.js";

const root = join(import.meta.dirname, "../..");
const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

async function loadSchema() {
  const raw = await readFile(
    join(root, "specs/schemas/anonymized-record.schema.json"),
    "utf8"
  );
  return JSON.parse(raw);
}

async function loadPayslipFixture(id: string): Promise<CanonicalPayslip> {
  const raw = await readFile(
    join(root, `specs/plugins/hilan/fixtures/${id}.json`),
    "utf8"
  );
  return JSON.parse(raw) as CanonicalPayslip;
}

describe("analytics contract", () => {
  it("anonymize(april-2026) validates against anonymized-record.schema.json", async () => {
    const schema = await loadSchema();
    const validate = ajv.compile(schema);
    const payslip = await loadPayslipFixture("april-2026");
    const record = anonymize(payslip);

    expect(record.userConsent).toBe(true);
    expect(record.vendorId).toBe("hilan");
    expect(validate(record)).toBe(true);
    if (!validate(record)) {
      throw new Error(JSON.stringify(validate.errors, null, 2));
    }
  });

  it("anonymize output contains no PII deny-list keys", async () => {
    const payslip = await loadPayslipFixture("may-2026");
    const record = anonymize(payslip);

    const forbidden = ["employee", "employer", "nationalId", "rawLabel", "payrollId", "name", "email"];
    const walk = (obj: unknown, path: string, found: string[]) => {
      if (!obj || typeof obj !== "object") return;
      if (Array.isArray(obj)) {
        obj.forEach((v, i) => walk(v, `${path}[${i}]`, found));
        return;
      }
      for (const key of Object.keys(obj as Record<string, unknown>)) {
        if (forbidden.includes(key)) found.push(path ? `${path}.${key}` : key);
        walk((obj as Record<string, unknown>)[key], path ? `${path}.${key}` : key, found);
      }
    };
    const found: string[] = [];
    walk(record, "", found);
    expect(found).toEqual([]);
  });

  it("may-2026 equity flags populate details.equity_event_types", async () => {
    const payslip = await loadPayslipFixture("may-2026");
    const record = anonymize(payslip);

    expect(record.flags).toContain("equity_vesting");
    expect(record.details?.equity_event_types).toEqual(
      expect.arrayContaining(["vesting", "espp"])
    );
    expect(record.details?.has_rsu_vesting).toBe(true);
  });
});
