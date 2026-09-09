import { PrismaClient, IntencaoSolicitacaoAssinatura } from "@prisma/client";
import { documentoValido } from "./documento";

export const OPERADOR_SISTEMA_ID = "00000000-0000-4000-8000-000000000001";

export interface DadosSolicitacao {
  produtoId: string;
  intencao: IntencaoSolicitacaoAssinatura;
  nomeOrganizacao: string;
  documento: string;
  responsavel: string;
  email: string;
  telefone?: string;
  origem?: Record<string, string>;
}

export class CriarSolicitacaoService {
  constructor(private readonly db: PrismaClient) {}

  async execute(dados: DadosSolicitacao, agora = new Date()) {
    return this.db.$transaction(async (tx) => {
      const [produto, assinante] = await Promise.all([
        tx.produto.findUnique({ where: { codigo: dados.produtoId }, select: {
          ativo: true, planos: { where: { ativo: true }, select: { versoes: { where: {
            vigenteDesde: { lte: agora }, OR: [{ vigenteAte: null }, { vigenteAte: { gt: agora } }],
          }, take: 1, select: { id: true } } }, take: 1 },
        } }),
        tx.assinante.findUnique({ where: { documento: dados.documento }, select: { id: true } }),
      ]);
      if (!produto) throw new Error("PRODUTO_NAO_ENCONTRADO");
      const automatica = produto.ativo && Boolean(produto.planos[0]?.versoes[0]) &&
        dados.intencao === "TESTE" && documentoValido(dados.documento) && !assinante;
      const solicitacao = await tx.solicitacaoAssinatura.create({ data: {
        ...dados, telefone: dados.telefone ?? null, origem: dados.origem ?? undefined,
        status: automatica ? "APROVADA" : "RECEBIDA",
        decididoEm: automatica ? agora : null, decididoPor: automatica ? OPERADOR_SISTEMA_ID : null,
      }, select: { id: true, produtoId: true, intencao: true, nomeOrganizacao: true, responsavel: true,
        status: true, criadoEm: true, decididoEm: true } });
      if (automatica) await tx.auditLogPlataforma.create({ data: {
        operadorId: OPERADOR_SISTEMA_ID, origem: "SISTEMA", acao: "SOLICITACAO_APROVADA_AUTOMATICAMENTE",
        alvoTipo: "SOLICITACAO_ASSINATURA", alvoId: solicitacao.id,
        mudancas: { produtoId: dados.produtoId, intencao: dados.intencao, documentoPresente: true,
          emailPresente: true, telefonePresente: Boolean(dados.telefone) },
      } });
      return solicitacao;
    });
  }
}
