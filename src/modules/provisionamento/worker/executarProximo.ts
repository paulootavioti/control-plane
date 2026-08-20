import { prisma } from "../../../shared/prisma";
import { ExecutarProvisionamento } from "./ExecutarProvisionamento";
import { InfraestruturaTenant } from "./contratos";
import { RepositorioProvisionamentoPrisma } from "./RepositorioProvisionamentoPrisma";

export async function executarProximo(infraestrutura: InfraestruturaTenant): Promise<"PROCESSADO" | "VAZIO"> {
  const repositorio = new RepositorioProvisionamentoPrisma(prisma);
  const evento = await repositorio.obterProximoElegivel();
  if (!evento) return "VAZIO";

  await new ExecutarProvisionamento(repositorio, infraestrutura).execute(evento);
  return "PROCESSADO";
}
