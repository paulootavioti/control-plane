import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { AuthProvider } from "./contexts/AuthContext";
import { AppRoutes } from "./routes";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  </StrictMode>
);
