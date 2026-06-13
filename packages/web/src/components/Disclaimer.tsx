import { useTranslation } from "react-i18next";
import { useUploadSession } from "../context/UploadSessionContext";

export function Disclaimer() {
  const { t } = useTranslation();
  const { session } = useUploadSession();
  const text = session.explanation?.disclaimer.text ?? t("disclaimer.not_tax_advice");

  return <footer className="disclaimer">{text}</footer>;
}
