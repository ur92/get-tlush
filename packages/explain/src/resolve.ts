import {
  getVendorKnowledge,
  sharedKnowledge,
  type VendorKnowledge,
} from "@tlush/knowledge";
import type { LineItem } from "./types.js";

const VARIABLE_CATEGORIES: Record<string, string> = {
  "earnings.bonus": "explain.earnings.bonus",
  "earnings.economic_adjustment": "explain.earnings.economicAdjustment",
  "earnings.reserve_duty": "explain.earnings.reserveDuty",
  "deduction.advance": "explain.deduction.advance",
  "deduction.correction": "explain.deduction.correction",
};

function matchLabelPattern(
  vendor: VendorKnowledge,
  rawLabel: string
): string | undefined {
  for (const entry of vendor.labelPatterns ?? []) {
    if (entry.patterns.some((pattern) => rawLabel.includes(pattern))) {
      return entry.explanationKey;
    }
  }
  return undefined;
}

function resolveFromVendor(
  vendorId: string,
  item: LineItem
): string | undefined {
  const vendor = getVendorKnowledge(vendorId);
  if (!vendor) {
    return undefined;
  }

  const codeMapping = vendor.codes[item.code];
  if (codeMapping) {
    return codeMapping.explanationKey;
  }

  return matchLabelPattern(vendor, item.rawLabel);
}

function resolveFromCategory(item: LineItem): string | undefined {
  if (item.category === "unknown") {
    return sharedKnowledge.categories.unknown.explanationKey;
  }

  const mapping = sharedKnowledge.categories[item.category];
  return mapping?.explanationKey;
}

export function resolveExplanationKey(
  vendorId: string,
  item: LineItem
): { explanationKey: string; unclassified: boolean } {
  if (item.category === "unknown") {
    return {
      explanationKey: sharedKnowledge.categories.unknown.explanationKey,
      unclassified: true,
    };
  }

  if (item.explanationKey) {
    return { explanationKey: item.explanationKey, unclassified: false };
  }

  const vendorKey = resolveFromVendor(vendorId, item);
  const categoryKey = resolveFromCategory(item);
  const variableKey = VARIABLE_CATEGORIES[item.category];

  const key =
    vendorKey ?? categoryKey ?? variableKey ?? sharedKnowledge.categories.unknown.explanationKey;

  return {
    explanationKey: key,
    unclassified: key === sharedKnowledge.categories.unknown.explanationKey,
  };
}
