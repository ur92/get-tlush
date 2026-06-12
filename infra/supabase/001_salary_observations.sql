-- Analytics ingest: anonymized salary observations (no PII).
-- Run once in Supabase SQL editor or via migration tooling.

CREATE TABLE IF NOT EXISTS salary_observations (
  record_id UUID PRIMARY KEY,
  period_year INTEGER NOT NULL CHECK (period_year >= 2000 AND period_year <= 2100),
  period_month INTEGER NOT NULL CHECK (period_month >= 1 AND period_month <= 12),
  vendor_id TEXT NOT NULL,
  gross_cash NUMERIC NOT NULL,
  taxable_gross NUMERIC NOT NULL,
  net_pay NUMERIC NOT NULL,
  income_tax NUMERIC NOT NULL,
  ni NUMERIC NOT NULL,
  health_tax NUMERIC NOT NULL,
  pension_employee NUMERIC,
  has_equity BOOLEAN,
  details JSONB,
  optional_context JSONB,
  category_counts JSONB NOT NULL,
  flags JSONB NOT NULL,
  app_version TEXT NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL,
  contributor_token TEXT NOT NULL,
  core_hash TEXT NOT NULL,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_salary_obs_idempotency
  ON salary_observations (contributor_token, period_year, period_month, core_hash);

CREATE INDEX IF NOT EXISTS idx_salary_obs_period
  ON salary_observations (period_year, period_month);

CREATE INDEX IF NOT EXISTS idx_salary_obs_vendor
  ON salary_observations (vendor_id);
