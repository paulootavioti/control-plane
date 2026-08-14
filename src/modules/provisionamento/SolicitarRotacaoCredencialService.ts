import { PrismaClient } from "@prisma/client";
import { ContextoAuditoria } from "../auditoria/contextoAuditoria";
export class SolicitarRotacaoCredencialService {
 constructor(private db: PrismaClient) {}
 async execute(id:string,a:ContextoAuditoria){return this.db.$transaction(async tx=>{
  const ambiente=await tx.ambienteTenant.findUnique({where:{id},select:{id:true,assinanteId:true,status:true,credentialVersion:true}});
  if(!ambiente)throw new Error("AMBIENTE_NAO_ENCONTRADO"); if(ambiente.status!=="ATIVO")throw new Error("AMBIENTE_NAO_ELEGIVEL");
  const versao=(ambiente.credentialVersion??0)+1,chave=`rotacionar:${id}:v${versao}`;
  const existente=await tx.eventoProvisionamento.findUnique({where:{chaveIdempotencia:chave},select:{id:true}}); if(existente)return{ambienteId:id,eventoId:existente.id,duplicado:true};
  const evento=await tx.eventoProvisionamento.create({data:{ambienteTenantId:id,tipo:"ROTACIONAR_CREDENCIAL",chaveIdempotencia:chave},select:{id:true}});
  await tx.auditLogPlataforma.create({data:{...a,assinanteId:ambiente.assinanteId,acao:"ROTACAO_CREDENCIAL_SOLICITADA",alvoTipo:"AMBIENTE_TENANT",alvoId:id,mudancas:{versaoAtual:ambiente.credentialVersion,proximaVersao:versao}}});
  return{ambienteId:id,eventoId:evento.id,duplicado:false};
 });}
}
