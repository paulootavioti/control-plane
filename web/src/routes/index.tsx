import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { Layout } from "../components/Layout";
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
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
