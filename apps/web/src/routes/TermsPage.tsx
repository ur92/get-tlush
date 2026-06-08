import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { TERMS_SECTIONS, TERMS_UPDATED } from "../content/terms";

export function TermsPage() {
  const { t } = useTranslation();

  return (
    <div className="terms-page">
      <header className="terms-header">
        <Link to="/login" className="btn btn-text">
          ← {t("terms.back")}
        </Link>
        <h1>{t("terms.title")}</h1>
      </header>
      <article className="terms-content">
        {TERMS_SECTIONS.map((section) => (
          <section key={section.title}>
            <h2>{section.title}</h2>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </section>
        ))}
        <p className="terms-updated">
          <em>{TERMS_UPDATED}</em>
        </p>
      </article>
    </div>
  );
}
