export interface DadosDocumentoFiscal {
  faturaId: string;
  documentoTomador: string;
  descricao: string;
  valorCentavos: number;
  competencia: string;
}

export interface ProvedorFiscal {
  emitir(dados: DadosDocumentoFiscal): Promise<{ referenciaExterna: string; status: string }>;
  consultar(referenciaExterna: string): Promise<{ status: string }>;
  cancelar(referenciaExterna: string): Promise<void>;
}

// A integração municipal real não faz parte desta sessão. O fake permite testar
// a fronteira sem assumir prefeitura, código de serviço ou regra tributária.
export class ProvedorFiscalFake implements ProvedorFiscal {
  async emitir(dados: DadosDocumentoFiscal) {
    return { referenciaExterna: `nfse_fake_${dados.faturaId}`, status: "EMITIDA" };
  }
  async consultar(_referenciaExterna: string) { return { status: "EMITIDA" }; }
  async cancelar(_referenciaExterna: string) { return undefined; }
}
