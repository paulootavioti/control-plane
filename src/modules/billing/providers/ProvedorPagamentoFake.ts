import type {
  AssinaturaRemota, CriarAssinaturaPagamento, CriarClientePagamento, ProvedorPagamento,
} from "./ProvedorPagamento";

export class ProvedorPagamentoFake implements ProvedorPagamento {
  readonly nome = "FAKE" as const;
  readonly clientes = new Map<string, { id: string; dados: CriarClientePagamento }>();
  readonly assinaturas = new Map<string, AssinaturaRemota>();

  async criarCliente(dados: CriarClientePagamento, chaveIdempotencia: string) {
    const existente = this.clientes.get(chaveIdempotencia);
    if (existente) return { id: existente.id };
    const id = `cus_fake_${this.clientes.size + 1}`;
    this.clientes.set(chaveIdempotencia, { id, dados });
    return { id };
  }

  async criarAssinatura(dados: CriarAssinaturaPagamento, chaveIdempotencia: string) {
    const existente = this.assinaturas.get(chaveIdempotencia);
    if (existente) return existente;
    const assinatura = {
      id: `sub_fake_${this.assinaturas.size + 1}`,
      status: "authorized",
      referenciaExterna: dados.referenciaExterna,
    };
    this.assinaturas.set(chaveIdempotencia, assinatura);
    return assinatura;
  }

  async obterAssinatura(id: string) {
    const assinatura = [...this.assinaturas.values()].find((item) => item.id === id);
    if (!assinatura) throw new Error("ASSINATURA_REMOTA_NAO_ENCONTRADA");
    return assinatura;
  }

  async cancelarAssinatura(id: string) {
    const assinatura = await this.obterAssinatura(id);
    assinatura.status = "cancelled";
  }
}
