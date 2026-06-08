#!/usr/bin/env node
/**
 * Validates specs/schemas and golden fixtures with ajv.
 * - plugin fixtures under specs/plugins/<vendor>/fixtures/
 * - anonymized fixtures under specs/analytics/fixtures/ (if present)
 * - plugin manifest.json files (valid JSON)
 */
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL("..", import.meta.url)));
const specsDir = join(root, "specs");
const schemasDir = join(specsDir, "schemas");

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

async function loadSchemas() {
  const entries = await readdir(schemasDir);
  for (const name of entries) {
    if (!name.endsWith(".schema.json")) continue;
    const raw = await readFile(join(schemasDir, name), "utf8");
    const schema = JSON.parse(raw);
    ajv.addSchema(schema, schema.$id ?? name);
  }
}

async function collectJsonFiles(dir, pattern = /\.json$/) {
  const files = [];
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...(await collectJsonFiles(fullPath, pattern)));
      } else if (pattern.test(entry.name)) {
        files.push(fullPath);
      }
    }
  } catch {
    // directory may not exist yet
  }
  return files;
}

async function listPluginManifests() {
  const pluginsDir = join(specsDir, "plugins");
  const manifests = [];
  try {
    const entries = await readdir(pluginsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      manifests.push(join(pluginsDir, entry.name, "manifest.json"));
    }
  } catch {
    return [];
  }
  return manifests;
}

function rel(path) {
  return relative(root, path);
}

function formatErrors(errors) {
  return errors
    .map((e) => `  ${e.instancePath || "/"} ${e.message}`)
    .join("\n");
}

async function validateAgainst(schemaId, filePath) {
  const validate = ajv.getSchema(schemaId);
  if (!validate) {
    throw new Error(`schema not loaded: ${schemaId}`);
  }
  const raw = await readFile(filePath, "utf8");
  const data = JSON.parse(raw);
  if (!validate(data)) {
    console.error(`[spec:validate] FAIL ${rel(filePath)}`);
    console.error(formatErrors(validate.errors ?? []));
    return false;
  }
  console.log(`[spec:validate] OK   ${rel(filePath)}`);
  return true;
}

async function validateManifest(manifestPath) {
  try {
    const raw = await readFile(manifestPath, "utf8");
    JSON.parse(raw);
    console.log(`[spec:validate] OK   ${rel(manifestPath)} (manifest)`);
    return true;
  } catch (err) {
    console.error(`[spec:validate] FAIL ${rel(manifestPath)} (manifest)`);
    console.error(`  ${err.message}`);
    return false;
  }
}

await loadSchemas();

const canonicalSchemaId =
  "https://github.com/ur92/get-tlush/schemas/canonical-payslip.schema.json";
const anonymizedSchemaId =
  "https://github.com/ur92/get-tlush/schemas/anonymized-record.schema.json";

const pluginsDir = join(specsDir, "plugins");
const pluginDirs = await readdir(pluginsDir, { withFileTypes: true }).catch(
  () => []
);

const fixturePaths = [];
for (const entry of pluginDirs) {
  if (!entry.isDirectory()) continue;
  const fixturesDir = join(pluginsDir, entry.name, "fixtures");
  fixturePaths.push(...(await collectJsonFiles(fixturesDir)));
}

const anonymizedFixturePaths = await collectJsonFiles(
  join(specsDir, "analytics", "fixtures")
);

const manifestPaths = await listPluginManifests();

let ok = true;

for (const path of fixturePaths) {
  ok = (await validateAgainst(canonicalSchemaId, path)) && ok;
}

if (anonymizedFixturePaths.length > 0) {
  for (const path of anonymizedFixturePaths) {
    ok = (await validateAgainst(anonymizedSchemaId, path)) && ok;
  }
} else {
  console.log(
    "[spec:validate] skip anonymized-record — no specs/analytics/fixtures/*.json"
  );
}

for (const path of manifestPaths) {
  ok = (await validateManifest(path)) && ok;
}

if (!ok) {
  process.exit(1);
}

console.log(
  `[spec:validate] passed — ${fixturePaths.length} payslip fixture(s), ${anonymizedFixturePaths.length} anonymized fixture(s), ${manifestPaths.length} manifest(s)`
);
