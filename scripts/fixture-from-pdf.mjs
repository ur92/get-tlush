#!/usr/bin/env node
/**
 * Parse a local payslip PDF, redact PII, validate against canonical schema, write golden JSON.
 *
 * Usage:
 *   node scripts/fixture-from-pdf.mjs --vendor hilan|merkava --id april-2026 --pdf path/to.pdf --out specs/plugins/hilan/fixtures/april-2026.json
 */
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { extractPdf } from "@tlush/pdf-extract";
import { hilanParser } from "@tlush/parser-hilan";
import { merkavaParser } from "@tlush/parser-merkava";

const ROOT = join(fileURLToPath(new URL("..", import.meta.url)));

const PARSERS = {
  hilan: hilanParser,
  merkava: merkavaParser,
};

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--vendor") args.vendor = argv[++i];
    else if (arg === "--id") args.id = argv[++i];
    else if (arg === "--pdf") args.pdf = argv[++i];
    else if (arg === "--out") args.out = argv[++i];
    else if (arg === "--source-pdf") args.sourcePdf = argv[++i];
  }
  return args;
}

function redactPayslip(payslip) {
  const redacted = structuredClone(payslip);

  if (redacted.employee) {
    redacted.employee = {
      name: "REDACTED",
      nationalId: "REDACTED",
      employeeId: "REDACTED",
    };
  }

  if (redacted.employer) {
    redacted.employer = {
      ...redacted.employer,
      name: "REDACTED_EMPLOYER",
      registrationId: "REDACTED",
      payrollId: "REDACTED",
    };
    if ("bankAccount" in redacted.employer) {
      redacted.employer.bankAccount = "REDACTED";
    }
    if ("bankBranch" in redacted.employer) {
      redacted.employer.bankBranch = "REDACTED";
    }
  }

  if (redacted.parseMeta?.warnings) {
    redacted.parseMeta.warnings = redacted.parseMeta.warnings.filter(
      (entry) => !/\d{5,}/.test(entry)
    );
  }

  return redacted;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const vendor = args.vendor;
  const pdfPath = resolve(args.pdf ?? "");
  const outPath = resolve(args.out ?? "");

  if (!vendor || !PARSERS[vendor]) {
    throw new Error("--vendor hilan|merkava is required");
  }
  if (!pdfPath || !outPath) {
    throw new Error("--pdf and --out are required");
  }

  const parser = PARSERS[vendor];
  const pdfBytes = await readFile(pdfPath);
  const doc = await extractPdf(
    pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength)
  );
  const parsed = parser.parse(doc);
  const redacted = redactPayslip(parsed);

  const schemasDir = join(ROOT, "specs/schemas");
  const schemaEntries = await readdir(schemasDir);
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  for (const name of schemaEntries) {
    if (!name.endsWith(".schema.json")) continue;
    const schema = JSON.parse(await readFile(join(schemasDir, name), "utf8"));
    ajv.addSchema(schema, schema.$id ?? name);
  }

  const validate = ajv.getSchema(
    "https://github.com/ur92/get-tlush/schemas/canonical-payslip.schema.json"
  );
  if (!validate) {
    throw new Error("canonical payslip schema not loaded");
  }
  if (!validate(redacted)) {
    throw new Error(`schema validation failed:\n${JSON.stringify(validate.errors, null, 2)}`);
  }

  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, `${JSON.stringify(redacted, null, 2)}\n`, "utf8");
  console.log(`Wrote ${outPath}`);
  console.log(
    `  period=${redacted.period.label} net=${redacted.totals.netPay} earnings=${redacted.totals.totalEarnings ?? redacted.totals.grossCash}`
  );
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
