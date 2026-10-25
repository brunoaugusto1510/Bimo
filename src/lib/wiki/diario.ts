import type { AlertaWiki, TipoDeEventoWiki } from "./observabilidade-tipos";

export function textoDaPublicacao(titulo: string, nova: boolean) {
  return `${nova ? "Nasceu o neurônio" : "Cresceu o neurônio"} “${titulo.slice(0, 200)}”.`;
}
const textos: Record<AlertaWiki, string> = {
  sem_raizes: "As notas de origem deste neurônio não estão mais disponíveis.",
  divergencias: "Há afirmações que divergem; confira os dois contextos.",
  duplicata: "Há neurônios com títulos ou apelidos semelhantes; confira se tratam do mesmo conceito.",
  protegida_com_novidades: "Seu neurônio tem anotações relacionadas que ainda não foram incorporadas.",
  ligacao_quebrada: "Uma ligação deste neurônio aponta para outro que não está mais disponível.",
};
export function eventoDoDiagnostico(alertas: AlertaWiki[]): { tipo: TipoDeEventoWiki; texto: string } {
  return { tipo: alertas.length === 1 && alertas[0] === "divergencias" ? "discordam" : "precisa_de_voce",
    texto: alertas.map((a) => textos[a]).join(" ").slice(0, 500) };
}
