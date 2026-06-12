import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import {
  getDevBypassOidcEnv,
  isDevNoAuthEnabled,
  OidcProvider,
  validateOidcEnv,
} from "@tlush/auth";
import { UploadSessionProvider } from "./context/UploadSessionContext";
import { BreakdownPage } from "./routes/BreakdownPage";
import { CallbackPage } from "./routes/CallbackPage";
import { LoginPage } from "./routes/LoginPage";
import { ProtectedRoute } from "./routes/ProtectedRoute";
import { SummaryPage } from "./routes/SummaryPage";
import { TermsPage } from "./routes/TermsPage";
import { UploadPage } from "./routes/UploadPage";
import { useTranslation } from "react-i18next";

function ConfigError() {
  const { t } = useTranslation();
  return (
    <main className="config-error">
      <p>{t("common.config_error")}</p>
    </main>
  );
}

function getOidcEnv() {
  try {
    return validateOidcEnv({
      VITE_GOOGLE_CLIENT_ID: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      VITE_OIDC_REDIRECT_URI: import.meta.env.VITE_OIDC_REDIRECT_URI,
    });
  } catch {
    return null;
  }
}

function HomeRedirect() {
  return <Navigate to={isDevNoAuthEnabled() ? "/app/upload" : "/login"} replace />;
}

export default function App() {
  const devBypass = isDevNoAuthEnabled();
  const oidcEnv = devBypass ? getDevBypassOidcEnv() : getOidcEnv();

  if (!oidcEnv) {
    return <ConfigError />;
  }

  return (
    <OidcProvider env={oidcEnv}>
      <UploadSessionProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<HomeRedirect />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/callback" element={<CallbackPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route
              path="/app/upload"
              element={
                <ProtectedRoute>
                  <UploadPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/summary"
              element={
                <ProtectedRoute>
                  <SummaryPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/breakdown"
              element={
                <ProtectedRoute>
                  <BreakdownPage />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </BrowserRouter>
      </UploadSessionProvider>
    </OidcProvider>
  );
}
