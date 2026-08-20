import { PrismaClient, StatusAmbienteTenant } from "@prisma/client";

const STATUS: StatusAmbienteTenant[] = ["PENDENTE","CRIANDO_PROJETO","GRAVANDO_SEGREDO","APLICANDO_MIGRATIONS","EXECUTANDO_BOOTSTRAP","VALIDANDO","ATIVO","FALHOU","SUSPENSO","DESATIVADO"];
export class ObterSaudeFrotaService {
  constructor(private readonly db: PrismaClient) {}
  async execute(agora = new Date()) {
    const limiteHealth = new Date(agora.getTime() - 24 * 60 * 60 * 1000);
    const [ambientes, eventosFalhos] = await Promise.all([
      this.db.ambienteTenant.findMany({ select: { status:true, schemaVersaoAtual:true, schemaVersaoDesejada:true, ultimoHealthCheckEm:true, ultimoBackupVerificadoEm:true } }),
      this.db.eventoProvisionamento.count({ where: { status:"FALHOU", tentativas:{ gte:5 } } }),
    ]);
    const porStatus = Object.fromEntries(STATUS.map(status => [status, ambientes.filter(a => a.status === status).length]));
    return {
      totalAmbientes: ambientes.length, porStatus,
      schemaDesatualizado: ambientes.filter(a => a.schemaVersaoAtual !== a.schemaVersaoDesejada).length,
      healthCheckAtrasado: ambientes.filter(a => a.status === "ATIVO" && (!a.ultimoHealthCheckEm || a.ultimoHealthCheckEm < limiteHealth)).length,
      backupNuncaVerificado: ambientes.filter(a => !a.ultimoBackupVerificadoEm).length,
      eventosFalhosDefinitivos: eventosFalhos,
      calculadoEm: agora,
    };
  }
}
