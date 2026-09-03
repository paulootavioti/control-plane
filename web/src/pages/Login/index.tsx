import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";

import { Button, ErrorMessage, Field, Input } from "../../components/ui";
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
    <main className="login-page">
      <section className="login-identity" aria-label="Sys Belt Control Plane">
        <strong className="login-brand">SYS BELT</strong>
        <div className="belt-mark" aria-hidden="true"><span /><span /><span /></div>
        <span className="login-product">CONTROL PLANE</span>
        <p className="login-note">Ferramenta interna de operação da plataforma. Acesso restrito à equipe Sys Belt.</p>
      </section>
      <section className="login-form-wrap">
      <form className="login-form" onSubmit={aoEnviar}>
        <h1>Entrar</h1>
        <Field id="email" label="E-mail">
          <Input id="email"
            type="email"
            value={email}
            onChange={(evento) => setEmail(evento.target.value)}
            autoComplete="email"
            required
          />
        </Field>
        <Field id="senha" label="Senha">
          <Input id="senha"
            type="password"
            value={senha}
            onChange={(evento) => setSenha(evento.target.value)}
            autoComplete="current-password"
            required
          />
        </Field>
        <ErrorMessage message={erro} />
        <Button type="submit" disabled={carregando}>
          {carregando ? "Entrando…" : "Entrar"}
        </Button>
        <p className="login-support">Problemas de acesso? Procure o administrador da plataforma.</p>
      </form>
      </section>
    </main>
  );
}
