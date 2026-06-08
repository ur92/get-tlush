import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@tlush/auth";

export function CallbackPage() {
  const { t } = useTranslation();
  const auth = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (auth.isLoading) return;
    if (auth.isAuthenticated) {
      navigate("/app/upload", { replace: true });
      return;
    }
    if (auth.error) {
      navigate("/login", { replace: true });
    }
  }, [auth.isLoading, auth.isAuthenticated, auth.error, navigate]);

  return <p className="loading">{t("login.loading")}</p>;
}
