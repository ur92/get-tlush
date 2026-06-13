import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { isDevNoAuthEnabled } from "@tlush/auth";
import type { CanonicalPayslip } from "@tlush/parser-core";
import type { ExplanationResult } from "@tlush/explain";
import { analyzePayslip } from "../lib/analyze-payslip";
import { fetchDevQaPayslip } from "../lib/dev-qa-payslip";

export type UploadSession = {
  termsAccepted: boolean;
  payslip: CanonicalPayslip | null;
  explanation: ExplanationResult | null;
};

type UploadSessionContextValue = {
  session: UploadSession;
  setSession: (session: UploadSession) => void;
  clearSession: () => void;
  /** True while the bundled QA payslip is loading in local dev bypass mode. */
  devBootstrapPending: boolean;
  /** Set when dev auto-load fails; upload screen remains as fallback. */
  devBootstrapError: string | null;
};

const defaultSession: UploadSession = {
  termsAccepted: true,
  payslip: null,
  explanation: null,
};

const UploadSessionContext = createContext<UploadSessionContextValue | null>(null);

export function UploadSessionProvider({ children }: { children: ReactNode }) {
  const devBypass = isDevNoAuthEnabled();
  const [session, setSessionState] = useState<UploadSession>(defaultSession);
  const [devBootstrapPending, setDevBootstrapPending] = useState(devBypass);
  const [devBootstrapError, setDevBootstrapError] = useState<string | null>(null);

  const setSession = useCallback((next: UploadSession) => {
    setSessionState(next);
  }, []);

  const clearSession = useCallback(() => {
    setSessionState(defaultSession);
  }, []);

  useEffect(() => {
    if (!devBypass) return;

    let cancelled = false;

    void (async () => {
      try {
        const file = await fetchDevQaPayslip();
        const { payslip, explanation } = await analyzePayslip(file);
        if (!cancelled) {
          setSessionState({ termsAccepted: true, payslip, explanation });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Dev QA payslip bootstrap failed";
        console.error("Dev QA payslip bootstrap failed:", err);
        if (!cancelled) {
          setDevBootstrapError(message);
        }
      } finally {
        if (!cancelled) {
          setDevBootstrapPending(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [devBypass]);

  const value = useMemo(
    () => ({ session, setSession, clearSession, devBootstrapPending, devBootstrapError }),
    [session, setSession, clearSession, devBootstrapPending, devBootstrapError]
  );

  return (
    <UploadSessionContext.Provider value={value}>{children}</UploadSessionContext.Provider>
  );
}

export function useUploadSession() {
  const ctx = useContext(UploadSessionContext);
  if (!ctx) {
    throw new Error("useUploadSession must be used within UploadSessionProvider");
  }
  return ctx;
}
