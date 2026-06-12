import { Link, Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@tlush/auth";
import { PublicPageShell } from "../components/PublicPageShell";

export function LoginPage() {
  const { t } = useTranslation();
  const auth = useAuth();

  if (auth.isLoading) {
    return (
      <PublicPageShell>
        <p className="loading public-loading">{t("login.loading")}</p>
      </PublicPageShell>
    );
  }

  if (auth.isAuthenticated) {
    return <Navigate to="/app/upload" replace />;
  }

  return (
    <PublicPageShell>
      <div className="login-card glass-surface card--elevated">
        <div className="logo">tlush</div>
        <h1>{t("login.title")}</h1>
        {auth.error ? (
          <p className="login-error" role="alert">
            {auth.error.message}
          </p>
        ) : null}
        <button
          type="button"
          className="btn btn-google"
          onClick={() => void auth.signinRedirect()}
        >
          <span className="google-icon" aria-hidden>
            G
          </span>
          {t("login.sign_in_google")}
        </button>
        <p className="login-terms-link">
          <Link to="/terms">{t("login.terms_link")}</Link>
        </p>
      </div>
    </PublicPageShell>
  );
}
