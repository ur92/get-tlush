import { isDevNoAuthEnabled } from "@tlush/auth";

const PRODUCTION_ANALYTICS_INGEST_URL =
  "https://gettlush.netlify.app/.netlify/functions/a";

const PRODUCTION_HOSTNAME = "gettlush.netlify.app";

export function isAnalyticsDisabled(): boolean {
  return isDevNoAuthEnabled();
}

export function getAnalyticsIngestUrl(): string | undefined {
  if (isAnalyticsDisabled()) {
    return undefined;
  }

  const envOverride = import.meta.env.VITE_ANALYTICS_INGEST_URL?.trim();
  if (envOverride) {
    return envOverride;
  }

  if (typeof window !== "undefined" && window.location.hostname === PRODUCTION_HOSTNAME) {
    return PRODUCTION_ANALYTICS_INGEST_URL;
  }

  return undefined;
}
