import type { PrismaClient } from "@prisma/client";
import type { MeioPagamentoRecorrente, ProvedorPagamento } from "./providers/ProvedorPagamento";

export interface DadosInicioCobranca {
  valorCentavos: number;
  meioPagamento: MeioPagamentoRecorrente;
  inicioEm: Date;
}

export class IniciarCobrancaRecorrenteService {
  constructor(private readonly db: PrismaClient, private readonly provedor: ProvedorPagamento) {}

  async execute(assinaturaId: string, dados: DadosInicioCobranca) {
    if (!Number.isInteger(dados.valorCentavos) || dados.valorCentavos <= 0) {
      throw new Error("VALOR_COBRANCA_INVALIDO");
    }
    const assinatura = await this.db.assinatura.findUnique({
      where: { id: assinaturaId },
      select: {
        id: true,
        status: true,
        produtoCodigo: true,
        gatewayClienteId: true,
        gatewayAssinaturaId: true,
        assinante: { select: { nomeFantasia: true, emailCobranca: true } },
      },
    });
    if (!assinatura || assinatura.status === "CANCELADA") throw new Error("ASSINATURA_NAO_ELEGIVEL");
    if (assinatura.gatewayAssinaturaId) {
      return { assinaturaId, gatewayAssinaturaId: assinatura.gatewayAssinaturaId, existente: true };
    }

    const cliente = assinatura.gatewayClienteId
      ? { id: assinatura.gatewayClienteId }
      : await this.provedor.criarCliente({
        referenciaExterna: assinatura.id,
        email: assinatura.assinante.emailCobranca,
        nome: assinatura.assinante.nomeFantasia,
      }, `cliente:${assinatura.id}:v1`);

    const remota = await this.provedor.criarAssinatura({
      referenciaExterna: assinatura.id,
      clienteId: cliente.id,
      pagadorEmail: assinatura.assinante.emailCobranca,
      descricao: `${assinatura.produtoCodigo} - assinatura mensal`,
      valorCentavos: dados.valorCentavos,
      moeda: "BRL",
      meioPagamento: dados.meioPagamento,
      inicioEm: dados.inicioEm,
    }, `assinatura:${assinatura.id}:v1`);

    await this.db.assinatura.update({
      where: { id: assinatura.id },
      data: {
        gateway: this.provedor.nome,
        gatewayClienteId: cliente.id,
        gatewayAssinaturaId: remota.id,
      },
    });
    return {
      assinaturaId,
      gatewayAssinaturaId: remota.id,
      statusRemoto: remota.status,
      checkoutUrl: remota.checkoutUrl,
      existente: false,
    };
  }
}
