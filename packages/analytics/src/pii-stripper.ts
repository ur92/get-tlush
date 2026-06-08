const PII_FIELD_KEYS = new Set([
  "employee",
  "employer",
  "employeeId",
  "nationalId",
  "name",
  "roles",
  "department",
  "grade",
  "registrationId",
  "payrollId",
  "email",
  "phone",
  "address",
  "bank",
  "account",
  "rawLabel",
  "label",
  "sub",
  "id_token",
]);

const PII_PATTERN =
  /(ת\.?ז\.?|תעודת\s*זהות|email|phone|address|passport|bank|account|manager|DB-)/i;

export function containsPiiKey(key: string): boolean {
  return PII_FIELD_KEYS.has(key) || PII_PATTERN.test(key);
}

export function stripPiiFromObject(
  value: unknown,
  path = ""
): Record<string, unknown> | unknown[] | unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item, index) => stripPiiFromObject(item, `${path}[${index}]`));
  }

  if (typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      const fullPath = path ? `${path}.${key}` : key;
      if (containsPiiKey(key)) {
        continue;
      }
      result[key] = stripPiiFromObject(child, fullPath);
    }
    return result;
  }

  if (typeof value === "string" && PII_PATTERN.test(value)) {
    return undefined;
  }

  return value;
}

export function assertNoPiiKeys(payload: Record<string, unknown>): void {
  const forbidden: string[] = [];

  const walk = (obj: unknown, prefix: string) => {
    if (!obj || typeof obj !== "object") return;
    if (Array.isArray(obj)) {
      obj.forEach((item, i) => walk(item, `${prefix}[${i}]`));
      return;
    }
    for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (containsPiiKey(key)) {
        forbidden.push(path);
      }
      walk(val, path);
    }
  };

  walk(payload, "");
  if (forbidden.length > 0) {
    throw new Error(`PII deny-list violation: ${forbidden.join(", ")}`);
  }
}
