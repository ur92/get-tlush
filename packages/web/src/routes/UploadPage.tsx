import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { submitObservation } from "@tlush/analytics";
import { extractPdf, PdfLoadError } from "@tlush/pdf-extract";
import {
  ScannedPdfError,
  UnrecognizedPayslipError,
} from "@tlush/parser-core";
import { useAuth } from "@tlush/auth";
import { isDevNoAuthEnabled } from "@tlush/auth";
import { AppLayout } from "../components/AppLayout";
import { TermsCheckbox } from "../components/TermsCheckbox";
import { useUploadSession } from "../context/UploadSessionContext";
import { getAnalyticsIngestUrl } from "../lib/analytics-config";
import { buildExplanation } from "../lib/explain";
import { parserRegistry } from "../parsers";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

export function UploadPage() {
  const { t } = useTranslation();
  const auth = useAuth();
  const navigate = useNavigate();
  const { setSession } = useUploadSession();
  const inputRef = useRef<HTMLInputElement>(null);

  const [termsAccepted, setTermsAccepted] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);

  const handleFile = (selected: File | null) => {
    setError(null);
    if (!selected) return;

    if (selected.type !== "application/pdf") {
      setError(t("upload.error.wrong_type"));
      return;
    }
    if (selected.size > MAX_FILE_SIZE) {
      setError(t("upload.error.too_large"));
      return;
    }
    setFile(selected);
  };

  const handleAnalyze = async () => {
    if (!file || !termsAccepted) return;

    setParsing(true);
    setError(null);

    try {
      const doc = await extractPdf(file);
      const payslip = parserRegistry.parse(doc);
      const explanation = buildExplanation(payslip);

      setSession({
        termsAccepted,
        payslip,
        explanation,
      });

      if (termsAccepted) {
        void submitObservation(payslip, {
          termsAccepted: true,
          idToken: auth.idToken,
          ingestUrl: getAnalyticsIngestUrl(),
        });
      }

      navigate("/app/summary");
    } catch (err) {
      if (err instanceof ScannedPdfError) {
        setError(t("upload.error.scanned"));
      } else if (err instanceof UnrecognizedPayslipError) {
        setError(t("upload.error.parse_fail"));
      } else if (err instanceof PdfLoadError) {
        setError(
          err.message.includes("size") ? t("upload.error.too_large") : t("upload.error.wrong_type")
        );
      } else {
        setError(t("upload.error.parse_fail"));
      }
    } finally {
      setParsing(false);
    }
  };

  return (
    <AppLayout title={t("upload.title")}>
      {isDevNoAuthEnabled() ? (
        <p className="dev-bypass-banner" role="status">
          {t("dev.bypass_notice")}
        </p>
      ) : null}
      <p className="page-intro">{t("upload.intro")}</p>

      <div className="trust-banner">
        <p className="trust-banner__title">{t("upload.trust_title")}</p>
        <p className="trust-banner__body">{t("upload.trust_body")}</p>
      </div>

      <div
        className="drop-zone"
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          handleFile(e.dataTransfer.files[0] ?? null);
        }}
      >
        <span className="drop-zone__icon" aria-hidden>
          📄
        </span>
        <p>{t("upload.drop_zone")}</p>
        <p className="drop-zone__hint">{t("upload.drop_hint")}</p>
        {file && <p className="file-name">{file.name}</p>}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        hidden
        onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
      />

      <TermsCheckbox checked={termsAccepted} onChange={setTermsAccepted} />

      {error && <p className="error-message">{error}</p>}

      <button
        type="button"
        className="btn btn-primary"
        disabled={!file || !termsAccepted || parsing}
        onClick={() => void handleAnalyze()}
      >
        {parsing ? t("upload.parsing") : t("upload.analyze")}
      </button>
    </AppLayout>
  );
}
