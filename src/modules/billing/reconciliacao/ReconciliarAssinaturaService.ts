import type { PrismaClient, StatusAssinatura } from "@prisma/client";
import type { ProvedorPagamento } from "../providers/ProvedorPagamento";

const MAPA_ESTADOS: Record<string, StatusAssinatura | undefined> = {
  authorized: "ATIVA",
  paused: "INADIMPLENTE",
  cancelled: "CANCELADA",
};

export class ReconciliarAssinaturaService {
  constructor(private readonly db: PrismaClient, private readonly provedor: ProvedorPagamento) {}

  async execute(assinaturaId: string, agora = new Date()) {
    const local = await this.db.assinatura.findUnique({
      where: { id: assinaturaId },
      select: { id: true, status: true, gatewayAssinaturaId: true },
    });
    if (!local?.gatewayAssinaturaId) throw new Error("ASSINATURA_SEM_VINCULO_PSP");
    const remota = await this.provedor.obterAssinatura(local.gatewayAssinaturaId);
    const destino = MAPA_ESTADOS[remota.status];
    if (!destino || destino === local.status) return { alterada: false, status: local.status, statusRemoto: remota.status };
    await this.db.assinatura.update({
      where: { id: local.id },
      data: {
        status: destino,
        primeiraFalhaPagamentoEm: destino === "INADIMPLENTE" ? agora : null,
        canceladaEm: destino === "CANCELADA" ? agora : undefined,
      },
    });
    if (destino === "ATIVA") {
      await this.db.tentativaDunning.updateMany({
        where: { assinaturaId: local.id, status: "PENDENTE" }, data: { status: "CANCELADA" },
      });
    }
    return { alterada: true, status: destino, statusRemoto: remota.status };
  }
}
