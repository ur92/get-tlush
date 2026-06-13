import { Navigate, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AppLayout } from "../components/AppLayout";
import { PayslipSummary } from "../components/PayslipSummary";
import { useUploadSession } from "../context/UploadSessionContext";

export function SummaryPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { session, devBootstrapPending } = useUploadSession();

  if (devBootstrapPending) {
    return (
      <AppLayout>
        <p className="loading">{t("common.loading")}</p>
      </AppLayout>
    );
  }

  if (!session.payslip || !session.explanation) {
    return <Navigate to="/app/upload" replace />;
  }

  return (
    <AppLayout>
      <PayslipSummary
        payslip={session.payslip}
        explanation={session.explanation}
        onContinue={() => navigate("/app/breakdown")}
      />
    </AppLayout>
  );
}
