/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_CLIENT_ID: string;
  readonly VITE_OIDC_REDIRECT_URI: string;
  readonly VITE_ANALYTICS_INGEST_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
