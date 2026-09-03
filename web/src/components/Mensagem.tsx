interface MensagemProps {
  texto: string;
  tipo?: "erro" | "vazio";
}

export function Mensagem({ texto, tipo = "erro" }: MensagemProps) {
  if (!texto) return null;
  return <p className={`mensagem mensagem-${tipo}`} role={tipo === "erro" ? "alert" : "status"} aria-live={tipo === "erro" ? "assertive" : "polite"}>{texto}</p>;
}
