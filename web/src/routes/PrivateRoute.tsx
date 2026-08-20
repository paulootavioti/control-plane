import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";

import { useAuth } from "../contexts/useAuth";
import type { PerfilOperador } from "../contexts/authContextData";

interface PrivateRouteProps {
  children: ReactNode;
  perfis?: PerfilOperador[];
}

export function PrivateRoute({ children, perfis = [] }: PrivateRouteProps) {
  const { token, podeVer } = useAuth();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // Perfil sem alcance volta para a home em vez de ver uma tela vazia. Isto é
  // só para não oferecer o que o servidor recusaria — a autorização real
  // acontece em cada rota da API.
  if (!podeVer(perfis)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
