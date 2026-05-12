import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./store/themeStore"; // side-effect: apply persisted theme before first paint
import { App } from "./App";
import { AuthGate } from "./auth/AuthGate";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthGate>
      <App />
    </AuthGate>
  </StrictMode>,
);
