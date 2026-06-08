import { useEffect } from "react";
import { Link, Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@tlush/auth";

export function LoginPage() {
  const { t } = useTranslation();
  const auth = useAuth();

  useEffect(() => {
    if (auth.isAuthenticated) return;
  }, [auth.isAuthenticated]);

  if (auth.isLoading) {
    return <p className="loading">{t("login.loading")}</p>;
  }

  if (auth.isAuthenticated) {
    return <Navigate to="/app/upload" replace />;
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="logo">tlush</div>
        <h1>{t("login.title")}</h1>
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
        <p>
          <Link to="/terms">{t("login.terms_link")}</Link>
        </p>
      </div>
    </div>
  );
}
