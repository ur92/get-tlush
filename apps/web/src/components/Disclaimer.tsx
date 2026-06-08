import { useTranslation } from "react-i18next";

export function Disclaimer() {
  const { t } = useTranslation();
  return <footer className="disclaimer">{t("disclaimer.not_tax_advice")}</footer>;
}
