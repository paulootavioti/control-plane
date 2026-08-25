import { PrismaClient } from "@prisma/client";
import { ContextoAuditoria } from "../../auditoria/contextoAuditoria";

interface VerificadorMercadoPago {
  validarCredencial(): Promise<{ contaId: string; siteId: string; ativa: boolean }>;
}

export class ValidarHomologacaoMercadoPagoService {
  constructor(private readonly db: PrismaClient, private readonly provedor: VerificadorMercadoPago) {}

  async execute(auditoria: ContextoAuditoria, agora = new Date()) {
    try {
      const conta = await this.provedor.validarCredencial();
      if (!conta.ativa) throw new Error("MERCADO_PAGO_CONTA_INATIVA");

      await this.registrar(auditoria, "SUCESSO", conta.siteId, agora);
      return { valido: true, siteId: conta.siteId, verificadoEm: agora };
    } catch (erro) {
      const codigo = erro instanceof Error && erro.message.startsWith("MERCADO_PAGO_")
        ? erro.message
        : "MERCADO_PAGO_INDISPONIVEL";
      await this.registrar(auditoria, "FALHOU", undefined, agora, codigo);
      throw new Error(codigo);
    }
  }

  private async registrar(
    auditoria: ContextoAuditoria,
    resultado: "SUCESSO" | "FALHOU",
    siteId: string | undefined,
    agora: Date,
    codigo?: string,
  ) {
    await this.db.auditLogPlataforma.create({ data: {
      ...auditoria,
      acao: "MERCADO_PAGO_HOMOLOGACAO_VALIDADA",
      alvoTipo: "INTEGRACAO_PSP",
      alvoId: "MERCADO_PAGO",
      mudancas: { resultado, siteId, codigo, verificadoEm: agora.toISOString() },
    } });
  }
}
