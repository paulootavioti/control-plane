import { describe, expect, it, vi } from "vitest";
import { CriarSolicitacaoService, OPERADOR_SISTEMA_ID } from "./CriarSolicitacaoService";

const base={produtoId:"sysbelt",intencao:"TESTE" as const,nomeOrganizacao:"Empresa",documento:"11222333000181",responsavel:"Ana",email:"ana@empresa.test"};
function banco(produto:unknown={ativo:true,planos:[{versoes:[{id:"v1"}]}]}, assinante:unknown=null){
 const create=vi.fn().mockImplementation(({data})=>({...data,id:"s1",criadoEm:new Date()})); const audit=vi.fn();
 const tx={produto:{findUnique:vi.fn().mockResolvedValue(produto)},assinante:{findUnique:vi.fn().mockResolvedValue(assinante)},solicitacaoAssinatura:{create},auditLogPlataforma:{create:audit}};
 return {tx,create,audit,db:{$transaction:vi.fn((fn)=>fn(tx))}};
}
describe("aprovação automática da solicitação",()=>{
 it("aprova teste elegível e audita sem dados pessoais",async()=>{const {db,create,audit}=banco();await new CriarSolicitacaoService(db as never).execute(base);
  expect(create).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({status:"APROVADA",decididoPor:OPERADOR_SISTEMA_ID})}));
  const mudancas=audit.mock.calls[0][0].data.mudancas;expect(JSON.stringify(mudancas)).not.toContain(base.documento);expect(JSON.stringify(mudancas)).not.toContain(base.email);
 });
 it.each([
  ["produto inativo",{ativo:false,planos:[{versoes:[{id:"v"}]}]},null,base],
  ["sem versão vigente",{ativo:true,planos:[{versoes:[]}]},null,base],
  ["intenção imediata",{ativo:true,planos:[{versoes:[{id:"v"}]}]},null,{...base,intencao:"ASSINATURA_IMEDIATA" as const}],
  ["documento inválido",{ativo:true,planos:[{versoes:[{id:"v"}]}]},null,{...base,documento:"11111111111"}],
  ["documento já cadastrado",{ativo:true,planos:[{versoes:[{id:"v"}]}]},{id:"a1"},base],
 ])("mantém RECEBIDA quando %s",async(_nome,produto,assinante,dados)=>{const {db,create,audit}=banco(produto,assinante);await new CriarSolicitacaoService(db as never).execute(dados);
   expect(create).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({status:"RECEBIDA",decididoPor:null})}));expect(audit).not.toHaveBeenCalled();});
});
