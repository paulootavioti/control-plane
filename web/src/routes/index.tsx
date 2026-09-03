import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { Layout } from "../components/Layout";
import { Assinante } from "../pages/Assinante";
import { Assinantes } from "../pages/Assinantes";
import { Dashboard } from "../pages/Dashboard";
import { Billing } from "../pages/Billing";
import { Login } from "../pages/Login";
import { Provisionamento } from "../pages/Provisionamento";
import { PrivateRoute } from "./PrivateRoute";

export function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route
          path="/"
          element={
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="assinantes" element={<Assinantes />} />
          <Route path="assinantes/:assinanteId" element={<Assinante />} />
          <Route path="billing" element={<PrivateRoute perfis={["FINANCEIRO", "ADMIN_PLATAFORMA"]}><Billing /></PrivateRoute>} />
          <Route path="provisionamento" element={<PrivateRoute perfis={["ADMIN_PLATAFORMA"]}><Provisionamento /></PrivateRoute>} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
