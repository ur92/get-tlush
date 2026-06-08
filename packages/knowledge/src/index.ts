import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PKG_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadJson<T>(relativePath: string): T {
  const raw = readFileSync(join(PKG_ROOT, relativePath), "utf8");
  return JSON.parse(raw) as T;
}

export type LocaleStrings = Record<string, unknown>;

export type CategoryMapping = {
  explanationKey: string;
  isImputed?: boolean;
};

export type VendorCodeMapping = {
  category: string;
  explanationKey: string;
};

export type VendorKnowledge = {
  vendor: string;
  version: string;
  mappingStrategy: "code_first" | "label_first";
  codes: Record<string, VendorCodeMapping>;
  labelPatterns?: Array<{
    patterns: string[];
    explanationKey: string;
    category?: string;
  }>;
};

export type SharedTaxKnowledge = {
  version: string;
  categories: Record<string, CategoryMapping>;
  waterfall: Record<string, string>;
  taxes: Record<string, string>;
  flags: Record<string, string>;
};

export const locales = {
  he: loadJson<LocaleStrings>("locales/he.json"),
} as const;

export const sharedKnowledge = loadJson<SharedTaxKnowledge>("shared/taxes.json");

export const vendorKnowledge: Record<string, VendorKnowledge> = {
  hilan: loadJson<VendorKnowledge>("vendors/hilan.json"),
  merkava: loadJson<VendorKnowledge>("vendors/merkava.json"),
};

export function getVendorKnowledge(vendorId: string): VendorKnowledge | undefined {
  return vendorKnowledge[vendorId];
}

export function getNestedString(
  obj: LocaleStrings,
  keyPath: string
): string | undefined {
  const parts = keyPath.split(".");
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || typeof current !== "object" || !(part in current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return typeof current === "string" ? current : undefined;
}

export function interpolate(
  template: string,
  vars: Record<string, string | number>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const value = vars[key];
    if (value === undefined) {
      return `{{${key}}}`;
    }
    if (typeof value === "number") {
      return value.toLocaleString("he-IL", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      });
    }
    return String(value);
  });
}

export function t(
  key: string,
  vars: Record<string, string | number> = {},
  locale: keyof typeof locales = "he"
): string {
  const template = getNestedString(locales[locale], key);
  if (!template) {
    return key;
  }
  return interpolate(template, vars);
}
