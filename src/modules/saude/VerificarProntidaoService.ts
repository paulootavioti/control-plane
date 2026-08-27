interface BancoProntidao {
  $queryRaw<T = unknown>(query: TemplateStringsArray): Promise<T>;
}

export class VerificarProntidaoService {
  constructor(private readonly db: BancoProntidao) {}

  async execute(): Promise<boolean> {
    try {
      await this.db.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}
