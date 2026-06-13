import { GlobalWorkerOptions } from "pdfjs-dist";
import { createRoot } from "react-dom/client";
import "./i18n";
import App from "./App";
import "./index.css";

// Stable same-origin worker — Cursor/Glass Simple Browser blocks Vite `@fs/` worker URLs.
GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

// StrictMode double-mounts in dev and breaks OIDC callback (authorization code is single-use).
createRoot(document.getElementById("root")!).render(<App />);
