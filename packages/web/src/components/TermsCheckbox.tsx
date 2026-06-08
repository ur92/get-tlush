import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

type TermsCheckboxProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
};

export function TermsCheckbox({ checked, onChange }: TermsCheckboxProps) {
  const { t } = useTranslation();
  const id = "terms-checkbox";

  return (
    <label className="terms-checkbox" htmlFor={id}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        {t("upload.terms_checkbox")}{" "}
        <Link to="/terms" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
          ({t("upload.terms_link")})
        </Link>
      </span>
    </label>
  );
}
