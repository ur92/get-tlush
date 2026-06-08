import { useTranslation } from "react-i18next";

type FlagBannerProps = {
  flag: string;
  severity?: "warning" | "info";
};

const FLAG_KEY_MAP: Record<string, string> = {
  negative_gross: "flags.negative_gross",
  tax_validation_mismatch: "flags.tax_mismatch",
  tax_mismatch: "flags.tax_mismatch",
  ni_adjustment: "flags.ni_adjustment",
  equity_vesting: "flags.equity_vesting",
  equity_espp: "flags.equity_espp",
  unknown_line_items: "flags.unknown_line_items",
};

export function FlagBanner({ flag, severity = "info" }: FlagBannerProps) {
  const { t } = useTranslation();
  const key = FLAG_KEY_MAP[flag];
  if (!key) return null;

  const role = severity === "warning" ? "alert" : "status";

  return (
    <div className={`flag-banner flag-banner--${severity}`} role={role}>
      {t(key)}
    </div>
  );
}
