import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AppLayout } from "../components/AppLayout";
import { FlagBanner } from "../components/FlagBanner";
import { NetBreakdown } from "../components/NetBreakdown";
import { SectionTable } from "../components/SectionTable";
import { useUploadSession } from "../context/UploadSessionContext";

type TabId = "fixed_variable" | "taxes" | "pension" | "equity";

export function BreakdownPage() {
  const { t } = useTranslation();
  const { session } = useUploadSession();
  const [activeTab, setActiveTab] = useState<TabId>("fixed_variable");

  if (!session.payslip || !session.explanation) {
    return <Navigate to="/app/upload" replace />;
  }

  const tabs: { id: TabId; key: string; visible: boolean }[] = [
    { id: "fixed_variable", key: "breakdown.tabs.fixed_variable", visible: true },
    { id: "taxes", key: "breakdown.tabs.taxes", visible: true },
    { id: "pension", key: "breakdown.tabs.pension", visible: true },
    {
      id: "equity",
      key: "breakdown.tabs.equity",
      visible: session.explanation.hasEquity,
    },
  ];

  return (
    <AppLayout title={t("breakdown.title")}>
      <Link to="/app/summary" className="btn btn-text">
        ← {t("upload.back")}
      </Link>

      <NetBreakdown steps={session.explanation.waterfall} />

      <div className="tabs" role="tablist">
        {tabs
          .filter((tab) => tab.visible)
          .map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`tab ${activeTab === tab.id ? "tab--active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {t(tab.key)}
            </button>
          ))}
      </div>

      <SectionTable rows={[]} />

      {session.explanation.flags.map((flag) => (
        <FlagBanner key={flag} flag={flag} />
      ))}
    </AppLayout>
  );
}
