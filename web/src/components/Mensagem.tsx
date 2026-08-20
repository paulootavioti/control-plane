interface MensagemProps {
  texto: string;
  tipo?: "erro" | "vazio";
}

export function Mensagem({ texto, tipo = "erro" }: MensagemProps) {
  if (!texto) return null;
  return <p className={`mensagem mensagem-${tipo}`}>{texto}</p>;
}
