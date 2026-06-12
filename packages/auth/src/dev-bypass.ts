type ViteImportMeta = ImportMeta & {
  env?: {
    DEV?: boolean;
    VITE_DEV_NO_AUTH?: string;
  };
};

function viteEnv(): NonNullable<ViteImportMeta["env"]> | undefined {
  if (typeof import.meta === "undefined") return undefined;
  return (import.meta as ViteImportMeta).env;
}

/** Local dev only: skip Google OIDC when `VITE_DEV_NO_AUTH=true` and Vite `DEV` is true. */
export function isDevNoAuthEnabled(): boolean {
  const env = viteEnv();
  if (env?.DEV !== true) return false;
  return env.VITE_DEV_NO_AUTH?.trim().toLowerCase() === "true";
}

export const DEV_BYPASS_ID_TOKEN = "dev-local-bypass";

export function getDevBypassAuthState() {
  return {
    isLoading: false,
    isAuthenticated: true,
    user: {
      profile: {
        sub: "dev-local-user",
        email: "dev@localhost",
      },
      id_token: DEV_BYPASS_ID_TOKEN,
    },
    error: undefined,
    signinRedirect: async () => {
      window.location.assign("/app/upload");
    },
    signoutRedirect: async () => {
      window.location.assign("/login");
    },
    idToken: DEV_BYPASS_ID_TOKEN,
  };
}

export function getDevBypassOidcEnv() {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "http://localhost:5173";
  return {
    VITE_GOOGLE_CLIENT_ID: "dev-local-bypass",
    VITE_OIDC_REDIRECT_URI: `${origin}/callback`,
  };
}
