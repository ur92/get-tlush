import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AppLayout } from "../components/AppLayout";
import { FlagBanner } from "../components/FlagBanner";
import { LineItemList } from "../components/LineItemList";
import { NetBreakdown } from "../components/NetBreakdown";
import {
  filterLineItemsForTab,
  hasEquityLineItems,
  type TabId,
} from "../lib/breakdown-tabs";
import { useUploadSession } from "../context/UploadSessionContext";

export function BreakdownPage() {
  const { t } = useTranslation();
  const { session } = useUploadSession();
  const [activeTab, setActiveTab] = useState<TabId>("fixed_variable");

  if (!session.payslip || !session.explanation) {
    return <Navigate to="/app/upload" replace />;
  }

  const { explanation } = session;
  const showEquity =
    (session.payslip.context.equity?.hasEquity ?? false) ||
    hasEquityLineItems(explanation.lineItems);

  const tabs: { id: TabId; key: string; visible: boolean }[] = [
    { id: "fixed_variable", key: "breakdown.tabs.fixed_variable", visible: true },
    { id: "taxes", key: "breakdown.tabs.taxes", visible: true },
    { id: "pension", key: "breakdown.tabs.pension", visible: true },
    { id: "equity", key: "breakdown.tabs.equity", visible: showEquity },
  ];

  const { items, insights } = filterLineItemsForTab(
    activeTab,
    explanation.lineItems,
    explanation.insights
  );

  return (
    <AppLayout title={t("breakdown.title")}>
      <Link to="/app/summary" className="btn btn-text">
        ← {t("upload.back")}
      </Link>

      <NetBreakdown steps={explanation.waterfall} />

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

      <p className="tab-intro">{t(`breakdown.tab_intro.${activeTab}`)}</p>

      <LineItemList
        items={items}
        insights={insights}
        emptyMessage={t("breakdown.tab_empty")}
      />

      {explanation.flags.map((flag) => (
        <FlagBanner key={flag.flag} flag={flag} />
      ))}
    </AppLayout>
  );
}
