import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ValidatedRecord } from "./validate-record.js";

export type SalaryObservationRow = {
  record_id: string;
  period_year: number;
  period_month: number;
  vendor_id: string;
  gross_cash: number;
  taxable_gross: number;
  net_pay: number;
  income_tax: number;
  ni: number;
  health_tax: number;
  pension_employee: number | null;
  has_equity: boolean | null;
  details: Record<string, unknown> | null;
  optional_context: Record<string, unknown> | null;
  category_counts: Record<string, number>;
  flags: string[];
  app_version: string;
  recorded_at: string;
  contributor_token: string;
  core_hash: string;
};

export type StoreResult = "inserted" | "duplicate";

export type ObservationStore = {
  insert(row: SalaryObservationRow): Promise<StoreResult>;
};

export function recordToRow(
  record: ValidatedRecord,
  contributorToken: string,
  coreHash: string
): SalaryObservationRow {
  return {
    record_id: record.recordId,
    period_year: record.period.year,
    period_month: record.period.month,
    vendor_id: record.vendorId,
    gross_cash: record.totals.grossCash,
    taxable_gross: record.totals.taxableGross,
    net_pay: record.totals.netPay,
    income_tax: record.totals.incomeTax,
    ni: record.totals.ni,
    health_tax: record.totals.healthTax,
    pension_employee: record.totals.pensionEmployee ?? null,
    has_equity: record.context?.hasEquity ?? null,
    details: record.details ?? null,
    optional_context: record.context ?? null,
    category_counts: record.categoryCounts,
    flags: record.flags,
    app_version: record.appVersion,
    recorded_at: record.recordedAt,
    contributor_token: contributorToken,
    core_hash: coreHash,
  };
}

export function createSupabaseStore(
  supabaseUrl: string,
  serviceRoleKey: string,
  client?: SupabaseClient
): ObservationStore {
  const supabase =
    client ??
    createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

  return {
    async insert(row: SalaryObservationRow): Promise<StoreResult> {
      const { error } = await supabase.from("salary_observations").insert(row);
      if (error?.code === "23505") {
        return "duplicate";
      }
      if (error) {
        throw error;
      }
      return "inserted";
    },
  };
}
