import type { ReactNode } from "react";
import { AuthProvider } from "react-oidc-context";
import { createOidcConfig, type OidcEnv } from "./oidc-config.js";

export type OidcProviderProps = {
  env: OidcEnv;
  children: ReactNode;
};

export function OidcProvider({ env, children }: OidcProviderProps) {
  return <AuthProvider {...createOidcConfig(env)}>{children}</AuthProvider>;
}
