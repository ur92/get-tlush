import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@tlush/auth";
import { Disclaimer } from "./Disclaimer";
import { ThemeToggle } from "./ThemeToggle";

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
      <header className="app-header glass-surface">
        {title ? <h1>{title}</h1> : <span className="app-header__brand">tlush</span>}
        <div className="app-header__actions">
          <ThemeToggle />
          {showSignOut && auth.isAuthenticated && (
            <button type="button" className="btn btn-text" onClick={() => void auth.signoutRedirect()}>
              {t("common.sign_out")}
            </button>
          )}
        </div>
      </header>
      <div className="app-content">{children}</div>
      <Disclaimer />
    </div>
  );
}
