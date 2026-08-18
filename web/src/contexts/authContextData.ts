import { createContext } from "react";

// Os quatro perfis do Control Plane, iguais ao enum PerfilOperador do schema.
// Não confundir com os perfis do tenant (DONO, ADMIN, PROFESSOR, RECEPCAO):
// são sistemas separados, com bancos e autenticações próprias.
export type PerfilOperador = "OPERADOR" | "FINANCEIRO" | "SUPORTE" | "ADMIN_PLATAFORMA";

export interface Operador {
  id: string;
  nome: string;
  email: string;
  perfil: PerfilOperador;
}

export interface AuthContextData {
  operador: Operador | null;
  token: string | null;
  login: (email: string, senha: string) => Promise<void>;
  logout: () => void;
  podeVer: (perfis: PerfilOperador[]) => boolean;
}

export const AuthContext = createContext({} as AuthContextData);
