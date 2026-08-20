import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { Layout } from "../components/Layout";
import { Assinante } from "../pages/Assinante";
import { Assinantes } from "../pages/Assinantes";
import { Dashboard } from "../pages/Dashboard";
import { Login } from "../pages/Login";
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
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
