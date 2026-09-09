import { NavLink, Outlet } from "react-router-dom";

import { useAuth } from "../contexts/useAuth";
import { Button } from "./ui";

const ROTULO_PERFIL = {
  OPERADOR: "Operador",
  FINANCEIRO: "Financeiro",
  SUPORTE: "Suporte",
  ADMIN_PLATAFORMA: "Administrador",
} as const;

export function Layout() {
  const { operador, logout, podeVer } = useAuth();

  return (
    <div className="app">
      <header className="topo">
        <div className="marca">
          <strong>SYS BELT</strong><small>CONTROL PLANE</small>
        </div>

        <nav className="menu">
          {podeVer(["ADMIN_PLATAFORMA"]) && <NavLink to="/" end>Visão geral</NavLink>}
          <NavLink to="/assinantes">Assinantes</NavLink>
          <NavLink to="/solicitacoes">Solicitações</NavLink>
          <NavLink to="/planos">Planos</NavLink>
          {podeVer(["FINANCEIRO", "ADMIN_PLATAFORMA"]) && (
            <NavLink to="/billing">Faturamento</NavLink>
          )}
          {podeVer(["ADMIN_PLATAFORMA"]) && <NavLink to="/provisionamento">Provisionamento</NavLink>}
          {podeVer(["ADMIN_PLATAFORMA"]) && <NavLink to="/auditoria">Auditoria</NavLink>}
        </nav>

        <div className="operador">
          <div className="operador-dados">
            <strong>{operador?.nome}</strong>
            <small>{operador ? ROTULO_PERFIL[operador.perfil] : ""}</small>
          </div>
          <Button type="button" variant="secondary" onClick={logout}>Sair</Button>
        </div>
      </header>

      <main className="conteudo">
        <Outlet />
      </main>
    </div>
  );
}
