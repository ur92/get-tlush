import { Navigate, useNavigate } from "react-router-dom";
import { AppLayout } from "../components/AppLayout";
import { FlagBanner } from "../components/FlagBanner";
import { PayslipSummary } from "../components/PayslipSummary";
import { useUploadSession } from "../context/UploadSessionContext";

export function SummaryPage() {
  const navigate = useNavigate();
  const { session } = useUploadSession();

  if (!session.payslip) {
    return <Navigate to="/app/upload" replace />;
  }

  return (
    <AppLayout>
      <PayslipSummary
        payslip={session.payslip}
        onContinue={() => navigate("/app/breakdown")}
      />
      {session.explanation?.flags.map((flag) => (
        <FlagBanner
          key={flag}
          flag={flag}
          severity={flag.includes("mismatch") || flag === "negative_gross" ? "warning" : "info"}
        />
      ))}
    </AppLayout>
  );
}
