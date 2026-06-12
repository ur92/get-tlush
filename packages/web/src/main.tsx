import { createRoot } from "react-dom/client";
import "./i18n";
import App from "./App";
import "./index.css";

// StrictMode double-mounts in dev and breaks OIDC callback (authorization code is single-use).
createRoot(document.getElementById("root")!).render(<App />);
