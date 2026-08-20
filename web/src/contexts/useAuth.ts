import { useContext } from "react";

import { AuthContext } from "./authContextData";

export function useAuth() {
  return useContext(AuthContext);
}
