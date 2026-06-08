import type { AuthProviderProps } from "react-oidc-context";

export type OidcEnv = {
  VITE_GOOGLE_CLIENT_ID: string;
  VITE_OIDC_REDIRECT_URI: string;
};

export function validateOidcEnv(env: Partial<OidcEnv>): OidcEnv {
  const clientId = env.VITE_GOOGLE_CLIENT_ID?.trim();
  const redirectUri = env.VITE_OIDC_REDIRECT_URI?.trim();

  if (!clientId || !redirectUri) {
    throw new Error(
      "Missing OIDC configuration: VITE_GOOGLE_CLIENT_ID and VITE_OIDC_REDIRECT_URI are required."
    );
  }

  return {
    VITE_GOOGLE_CLIENT_ID: clientId,
    VITE_OIDC_REDIRECT_URI: redirectUri,
  };
}

export function createOidcConfig(env: OidcEnv): AuthProviderProps {
  return {
    authority: "https://accounts.google.com",
    client_id: env.VITE_GOOGLE_CLIENT_ID,
    redirect_uri: env.VITE_OIDC_REDIRECT_URI,
    response_type: "code",
    scope: "openid email profile",
    automaticSilentRenew: true,
    onSigninCallback: () => {
      window.history.replaceState({}, document.title, window.location.pathname);
    },
  };
}
