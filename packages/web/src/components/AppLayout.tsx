import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@tlush/auth";
import { Disclaimer } from "./Disclaimer";

type AppLayoutProps = {
  children: ReactNode;
  title?: string;
  showSignOut?: boolean;
};

export function AppLayout({ children, title, showSignOut = true }: AppLayoutProps) {
  const { t } = useTranslation();
  const auth = useAuth();

  return (
    <div className="app-layout">
      <header className="app-header">
        {title && <h1>{title}</h1>}
        {showSignOut && auth.isAuthenticated && (
          <button type="button" className="btn btn-text" onClick={() => void auth.signoutRedirect()}>
            {t("common.sign_out")}
          </button>
        )}
      </header>
      <div className="app-content">{children}</div>
      <Disclaimer />
    </div>
  );
}
