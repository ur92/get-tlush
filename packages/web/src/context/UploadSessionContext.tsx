import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { CanonicalPayslip } from "@tlush/parser-core";
import type { ExplanationResult } from "../lib/explain";

export type UploadSession = {
  termsAccepted: boolean;
  payslip: CanonicalPayslip | null;
  explanation: ExplanationResult | null;
};

type UploadSessionContextValue = {
  session: UploadSession;
  setSession: (session: UploadSession) => void;
  clearSession: () => void;
};

const defaultSession: UploadSession = {
  termsAccepted: true,
  payslip: null,
  explanation: null,
};

const UploadSessionContext = createContext<UploadSessionContextValue | null>(null);

export function UploadSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<UploadSession>(defaultSession);

  const setSession = useCallback((next: UploadSession) => {
    setSessionState(next);
  }, []);

  const clearSession = useCallback(() => {
    setSessionState(defaultSession);
  }, []);

  const value = useMemo(
    () => ({ session, setSession, clearSession }),
    [session, setSession, clearSession]
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
