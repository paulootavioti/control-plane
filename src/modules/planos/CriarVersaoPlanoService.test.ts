import { describe, expect, it, vi } from "vitest";

import { CriarVersaoPlanoService } from "./CriarVersaoPlanoService";

const auditoria = {
  operadorId: "admin1",
  origem: "OPERADOR" as const,
  ip: "127.0.0.1",
  userAgent: "teste",
};
const inicioAnterior = new Date("2026-09-01T00:00:00.000Z");
const inicioNovo = new Date("2027-01-01T00:00:00.000Z");
const anterior = {
  id: "versao1", planoId: "plano1", versao: 1,
  vigenteDesde: inicioAnterior, vigenteAte: null,
  alunosPorBloco: 100, precoPorBlocoCentavos: 19900,
  blocosMinimosPorUnidade: 1, moeda: "BRL",
  recursos: { financeiro: true }, metadadosComerciais: null,
  criadoEm: inicioAnterior,
};
const dados = {
  vigenteDesde: inicioNovo,
  alunosPorBloco: 150,
  precoPorBlocoCentavos: 24900,
  blocosMinimosPorUnidade: 2,
  moeda: "BRL",
  recursos: { financeiro: true, relatorios: true },
  metadadosComerciais: { notaInterna: "não auditar" },
};

type VersaoMock = Omit<typeof anterior, "vigenteAte" | "recursos" | "metadadosComerciais"> & {
  vigenteAte: Date | null;
  recursos: Record<string, boolean>;
  metadadosComerciais: unknown;
};

function banco(versaoAnterior: VersaoMock = anterior, ativo = true) {
  const update = vi.fn();
  const create = vi.fn().mockImplementation(({ data }) => ({
    id: "versao2", ...data, vigenteAte: data.vigenteAte ?? null, criadoEm: inicioNovo,
  }));
  const auditCreate = vi.fn();
  const tx = {
    plano: { findUnique: vi.fn().mockResolvedValue({ id: "plano1", ativo }) },
    planoVersao: { findFirst: vi.fn().mockResolvedValue(versaoAnterior), update, create },
    auditLogPlataforma: { create: auditCreate },
  };
  const transaction = vi.fn(async (operacao) => operacao(tx));
  return { db: { $transaction: transaction }, tx, transaction, update, create, auditCreate };
}

describe("nova versão comercial de plano", () => {
  it("calcula a próxima versão e encerra apenas a vigência anterior aberta", async () => {
    const { db, transaction, update, create } = banco();
    const resultado = await new CriarVersaoPlanoService(db as never).execute("plano1", dados, auditoria);

    expect(resultado).toMatchObject({ criada: true, versao: { versao: 2 } });
    expect(update).toHaveBeenCalledWith({ where: { id: "versao1" }, data: { vigenteAte: inicioNovo } });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ planoId: "plano1", versao: 2, vigenteDesde: inicioNovo }),
    }));
    expect(transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "Serializable" });
  });

  it("é idempotente ao repetir a mesma publicação", async () => {
    const publicada = {
      ...anterior, versao: 2, vigenteDesde: inicioNovo, vigenteAte: null,
      alunosPorBloco: dados.alunosPorBloco,
      precoPorBlocoCentavos: dados.precoPorBlocoCentavos,
      blocosMinimosPorUnidade: dados.blocosMinimosPorUnidade,
      recursos: dados.recursos,
      metadadosComerciais: dados.metadadosComerciais,
    };
    const { db, create, auditCreate } = banco(publicada);
    const resultado = await new CriarVersaoPlanoService(db as never).execute("plano1", dados, auditoria);

    expect(resultado).toMatchObject({ criada: false, versao: { id: "versao1", versao: 2 } });
    expect(create).not.toHaveBeenCalled();
    expect(auditCreate).not.toHaveBeenCalled();
  });

  it("rejeita sobreposição com uma vigência previamente fechada sem a alterar", async () => {
    const { db, update, create } = banco({ ...anterior, vigenteAte: new Date("2027-02-01T00:00:00.000Z") });

    await expect(new CriarVersaoPlanoService(db as never).execute("plano1", dados, auditoria))
      .rejects.toThrow("VIGENCIA_SOBREPOSTA");
    expect(update).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it("não permite publicar versão em plano inativo", async () => {
    const { db, create } = banco(anterior, false);
    await expect(new CriarVersaoPlanoService(db as never).execute("plano1", dados, auditoria))
      .rejects.toThrow("PLANO_INATIVO");
    expect(create).not.toHaveBeenCalled();
  });

  it("audita condições conhecidas sem replicar metadados comerciais livres", async () => {
    const { db, auditCreate } = banco();
    await new CriarVersaoPlanoService(db as never).execute("plano1", dados, auditoria);

    const auditoriaCriada = auditCreate.mock.calls[0][0];
    expect(auditoriaCriada).toEqual({ data: expect.objectContaining({
      acao: "PLANO_VERSAO_CRIADA", alvoTipo: "PLANO", alvoId: "plano1",
      mudancas: expect.objectContaining({ versao: 2, precoPorBlocoCentavos: 24900 }),
    }) });
    expect(JSON.stringify(auditoriaCriada)).not.toContain("notaInterna");
  });
});
