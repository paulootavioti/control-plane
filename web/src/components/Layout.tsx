import { NavLink, Outlet } from "react-router-dom";

import { useAuth } from "../contexts/useAuth";

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
          <span className="selo">SB</span>
          <div>
            <strong>Control Plane</strong>
            <small>SysBelt</small>
          </div>
        </div>

        <nav className="menu">
          {podeVer(["ADMIN_PLATAFORMA"]) && (
            <NavLink to="/" end>
              Visão geral
            </NavLink>
          )}
          <NavLink to="/assinantes">Assinantes</NavLink>
        </nav>

        <div className="operador">
          <div className="operador-dados">
            <strong>{operador?.nome}</strong>
            <small>{operador ? ROTULO_PERFIL[operador.perfil] : ""}</small>
          </div>
          <button type="button" className="botao-texto" onClick={logout}>
            Sair
          </button>
        </div>
      </header>

      <main className="conteudo">
        <Outlet />
      </main>
    </div>
  );
}
