/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_CLIENT_ID: string;
  readonly VITE_OIDC_REDIRECT_URI: string;
  /** Optional dev override for local ingest testing; production uses hostname-based URL. */
  readonly VITE_ANALYTICS_INGEST_URL?: string;
  /** Local dev only: skip Google login and analytics when `true` (requires Vite `DEV`). */
  readonly VITE_DEV_NO_AUTH?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
