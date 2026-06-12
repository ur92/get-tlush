import { useAuth as useOidcAuth } from "react-oidc-context";
import { getDevBypassAuthState, isDevNoAuthEnabled } from "./dev-bypass.js";

export function useAuth() {
  const auth = useOidcAuth();

  if (isDevNoAuthEnabled()) {
    return getDevBypassAuthState();
  }

  return {
    isLoading: auth.isLoading,
    isAuthenticated: auth.isAuthenticated,
    user: auth.user,
    error: auth.error,
    signinRedirect: () => auth.signinRedirect(),
    signoutRedirect: async () => {
      await auth.removeUser();
      window.location.assign("/login");
    },
    idToken: auth.user?.id_token,
  };
}
