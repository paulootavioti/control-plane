import { useEffect, useState } from "react";

import { Mensagem } from "../../components/Mensagem";
import { api } from "../../services/api";
import { formatarCentavos, rotularStatus } from "../../utils/formatar";
import { getApiErrorMessage } from "../../utils/getApiErrorMessage";

interface ResumoFatura {
  quantidade: number;
  totalCentavos: number;
}

interface Resumo {
  assinantes: Record<string, number>;
  ambientes: Record<string, number>;
  licencas: Record<string, number>;
  faturas: Record<string, ResumoFatura>;
}

function Contagens({ titulo, dados }: { titulo: string; dados: Record<string, number> }) {
  // Estados zerados ficam de fora: uma parede de zeros esconde o que está
  // acontecendo de verdade.
  const comValor = Object.entries(dados).filter(([, quantidade]) => quantidade > 0);

  return (
    <section className="cartao">
      <h2>{titulo}</h2>
      {comValor.length === 0 ? (
        <p className="vazio">Nada registrado ainda.</p>
      ) : (
        <ul className="contagens">
          {comValor.map(([status, quantidade]) => (
            <li key={status}>
              <strong>{quantidade}</strong>
              <span>{rotularStatus(status)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function Dashboard() {
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    api
      .get<Resumo>("/dashboard/resumo")
      .then((resposta) => setResumo(resposta.data))
      .catch((erroDaBusca) =>
        setErro(getApiErrorMessage(erroDaBusca, "Não foi possível carregar a visão geral."))
      )
      .finally(() => setCarregando(false));
  }, []);

  if (carregando) return <p className="carregando">Carregando…</p>;
  if (erro) return <Mensagem texto={erro} />;
  if (!resumo) return null;

  const faturasComValor = Object.entries(resumo.faturas).filter(
    ([, dados]) => dados.quantidade > 0
  );

  return (
    <>
      <h1>Visão geral</h1>

      <div className="grade">
        <Contagens titulo="Assinantes" dados={resumo.assinantes} />
        <Contagens titulo="Ambientes" dados={resumo.ambientes} />
        <Contagens titulo="Licenças por unidade" dados={resumo.licencas} />

        <section className="cartao">
          <h2>Faturas</h2>
          {faturasComValor.length === 0 ? (
            <p className="vazio">Nada registrado ainda.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Situação</th>
                  <th>Qtd.</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {faturasComValor.map(([status, dados]) => (
                  <tr key={status}>
                    <td>{rotularStatus(status)}</td>
                    <td>{dados.quantidade}</td>
                    <td>{formatarCentavos(dados.totalCentavos)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </>
  );
}
