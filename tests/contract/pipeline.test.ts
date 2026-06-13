import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { describe, expect, it } from "vitest";
import { anonymize } from "@tlush/analytics";
import { explainPayslip } from "@tlush/explain";
import { getNestedString, locales } from "@tlush/knowledge";
import type { CanonicalPayslip } from "@tlush/parser-core";
import { loadPluginManifests } from "./load-manifests";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const SCHEMAS_DIR = join(ROOT, "specs/schemas");
const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

async function loadSchemas() {
  const entries = await readdir(SCHEMAS_DIR);
  for (const name of entries) {
    if (!name.endsWith(".schema.json")) continue;
    const schema = JSON.parse(await readFile(join(SCHEMAS_DIR, name), "utf8"));
    ajv.addSchema(schema, schema.$id ?? name);
  }
}

function collectKeys(obj: Record<string, unknown>, prefix = ""): string[] {
  const keys: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") {
      keys.push(path);
    } else if (value && typeof value === "object") {
      keys.push(...collectKeys(value as Record<string, unknown>, path));
    }
  }
  return keys;
}

const heKeys = new Set(collectKeys(locales.he as Record<string, unknown>));

function getAssertionValue(parsed: Record<string, unknown>, path: string): unknown {
  if (path === "totals.printedNetSalary") {
    const warnings = (parsed.parseMeta as { warnings?: string[] } | undefined)?.warnings ?? [];
    const warning = warnings.find((entry) => entry.startsWith("printed_net_salary:"));
    if (warning) {
      return Number.parseFloat(warning.split(":")[1] ?? "");
    }
  }

  return path.split(".").reduce<unknown>((current, key) => {
    if (current && typeof current === "object" && key in current) {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, parsed);
}

describe("pipeline contract", () => {
  it("every manifest golden fixture passes schema, explain, and anonymize checks", async () => {
    await loadSchemas();
    const validateCanonical = ajv.getSchema(
      "https://github.com/ur92/get-tlush/schemas/canonical-payslip.schema.json"
    );
    const validateAnonymized = ajv.getSchema(
      "https://github.com/ur92/get-tlush/schemas/anonymized-record.schema.json"
    );
    if (!validateCanonical || !validateAnonymized) {
      throw new Error("required schemas not loaded");
    }

    const forbidden = ["employee", "employer", "nationalId", "rawLabel", "payrollId", "name", "email"];
    const manifests = await loadPluginManifests();

    for (const { plugin, manifest } of manifests) {
      for (const fixture of manifest.fixtures) {
        const fixturePath = join(ROOT, "specs/plugins", plugin, fixture.expected);
        const raw = await readFile(fixturePath, "utf8");
        const payslip = JSON.parse(raw) as CanonicalPayslip;

        expect(validateCanonical(payslip), `${fixture.id} canonical schema`).toBe(true);

        const explained = explainPayslip(payslip);
        for (const item of explained.lineItems) {
          if (item.category === "unknown") {
            expect(item.explanationKey).toBe("explain.unknown");
            continue;
          }
          expect(item.explanationKey, `${fixture.id} ${item.code}`).toBeTruthy();
          expect(item.text, `${fixture.id} ${item.code}`).toBeTruthy();
          expect(heKeys.has(item.explanationKey), `${fixture.id} ${item.explanationKey}`).toBe(true);
        }

        for (const step of explained.waterfall) {
          expect(step.text, `${fixture.id} waterfall ${step.explanationKey}`).not.toBe(
            step.explanationKey
          );
        }

        expect(explained.disclaimer.explanationKey).toBe("disclaimer.not_tax_advice");
        expect(explained.disclaimer.text).toBeTruthy();

        const record = anonymize(payslip);
        expect(validateAnonymized(record), `${fixture.id} anonymized schema`).toBe(true);

        const found: string[] = [];
        const walk = (obj: unknown, path: string) => {
          if (!obj || typeof obj !== "object") return;
          if (Array.isArray(obj)) {
            obj.forEach((value, index) => walk(value, `${path}[${index}]`));
            return;
          }
          for (const key of Object.keys(obj as Record<string, unknown>)) {
            if (forbidden.includes(key)) found.push(path ? `${path}.${key}` : key);
            walk((obj as Record<string, unknown>)[key], path ? `${path}.${key}` : key);
          }
        };
        walk(record, "");
        expect(found, `${fixture.id} PII keys`).toEqual([]);

        if (fixture.assertions) {
          for (const [path, expected] of Object.entries(fixture.assertions)) {
            const actual = getAssertionValue(payslip as unknown as Record<string, unknown>, path);
            expect(actual, `${fixture.id} missing ${path}`).toBeTypeOf("number");
            expect(
              Math.abs((actual as number) - expected),
              `${fixture.id} ${path}: actual=${actual} expected=${expected}`
            ).toBeLessThanOrEqual(manifest.amountTolerance);
          }
        }

        if (fixture.requiredFlags?.length) {
          for (const flag of fixture.requiredFlags) {
            expect(payslip.flags, `${fixture.id} flag ${flag}`).toContain(flag);
          }
        }
      }
    }
  });
});
