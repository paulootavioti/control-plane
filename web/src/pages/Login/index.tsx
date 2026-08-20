import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";

import { Mensagem } from "../../components/Mensagem";
import { useAuth } from "../../contexts/useAuth";
import { getApiErrorMessage } from "../../utils/getApiErrorMessage";
import { lerSessaoExpirada, limparSessaoExpirada } from "../../utils/sessaoExpirada";

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  // O aviso é lido na montagem e limpo logo depois, para não reaparecer numa
  // próxima visita à tela de login dentro da mesma aba.
  const [erro, setErro] = useState(() => lerSessaoExpirada() ?? "");
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    limparSessaoExpirada();
  }, []);

  async function aoEnviar(evento: FormEvent) {
    evento.preventDefault();

    try {
      setCarregando(true);
      setErro("");
      await login(email, senha);
      navigate("/");
    } catch (erroDoLogin) {
      setErro(getApiErrorMessage(erroDoLogin, "E-mail ou senha inválidos."));
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="login-pagina">
      <form className="login-cartao" onSubmit={aoEnviar}>
        <div className="login-marca">
          <span className="selo">SB</span>
          <h1>Control Plane</h1>
          <p>Acesso restrito à operação do SysBelt</p>
        </div>

        <label>
          E-mail
          <input
            type="email"
            value={email}
            onChange={(evento) => setEmail(evento.target.value)}
            autoComplete="email"
            required
          />
        </label>

        <label>
          Senha
          <input
            type="password"
            value={senha}
            onChange={(evento) => setSenha(evento.target.value)}
            autoComplete="current-password"
            required
          />
        </label>

        <Mensagem texto={erro} />

        <button type="submit" disabled={carregando}>
          {carregando ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}
