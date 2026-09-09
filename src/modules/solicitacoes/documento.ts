export function documentoValido(valor: string): boolean {
  const documento = valor.replace(/\D/g, "");
  if (![11, 14].includes(documento.length) || /^(\d)\1+$/.test(documento)) return false;
  const validarDigito = (base: string, pesos: number[]) => {
    const soma = pesos.reduce((total, peso, indice) => total + Number(base[indice]) * peso, 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  if (documento.length === 11) {
    const primeiro = validarDigito(documento, [10, 9, 8, 7, 6, 5, 4, 3, 2]);
    const segundo = validarDigito(documento, [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
    return documento.endsWith(`${primeiro}${segundo}`);
  }
  const primeiro = validarDigito(documento, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const segundo = validarDigito(documento, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return documento.endsWith(`${primeiro}${segundo}`);
}
