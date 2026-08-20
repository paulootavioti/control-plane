// Erro cuja mensagem foi escrita para o usuário final ler.
//
// Existe para separar dois casos que `getApiErrorMessage` trata de formas
// opostas: uma recusa deliberada da aplicação ("este acesso é exclusivo para
// professores"), cuja mensagem deve aparecer na tela, e um defeito de
// programação ("Cannot read properties of undefined"), que precisa cair no
// texto genérico em vez de virar interface.
//
// Sem essa distinção, a alternativa seria aceitar qualquer `Error` — e aí todo
// bug passaria a ser exibido ao usuário com a redação de quem escreveu o
// código, não a de quem escreve para o cliente.
export class ErroDeUsuario extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ErroDeUsuario";
  }
}
