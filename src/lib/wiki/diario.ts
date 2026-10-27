import type { AlertaWiki, TipoDeEventoWiki } from "./observabilidade-tipos";
import type { DecisaoSemPublicacao } from "./editorial";

/** Dados editoriais privados do dono, exibidos como texto; nunca interpolados em logs ou erros HTTP. */
export function textoDoAdiamento(decisao?: DecisaoSemPublicacao) {
  return decisao?.decisao === "adiar"
    ? `Decisão adiada: ${decisao.motivo} Para reavaliar: ${decisao.condicao}`
    : "Uma leitura precisa de atenção antes de continuar. As anotações foram preservadas.";
}
export function textoDaConservacao(decisao?: DecisaoSemPublicacao) {
  return decisao?.decisao === "conservar_origem" ? `Conservei o conhecimento na anotação de origem: ${decisao.motivo}`
    : "Li esta anotação e não encontrei novidade sustentada para os neurônios.";
}

export function textoDaPublicacao(titulo: string, nova: boolean) {
  return `${nova ? "Nasceu o neurônio" : "Cresceu o neurônio"} “${titulo.slice(0, 200)}”.`;
}
const textos: Record<AlertaWiki, string> = {
  sem_raizes: "As notas de origem deste neurônio não estão mais disponíveis.",
  divergencias: "Há afirmações que divergem; confira os dois contextos.",
  duplicata: "Há neurônios com títulos ou apelidos semelhantes; confira se tratam do mesmo conceito.",
  protegida_com_novidades: "Seu neurônio tem anotações relacionadas que ainda não foram incorporadas.",
  ligacao_quebrada: "Uma ligação deste neurônio aponta para outro que não está mais disponível.",
  isolado: "Este neurônio ainda não se liga a nenhum outro; o Bimo vai reler a origem para procurar conexões.",
};
export function eventoDoDiagnostico(alertas: AlertaWiki[]): { tipo: TipoDeEventoWiki; texto: string } {
  return { tipo: alertas.length === 1 && alertas[0] === "divergencias" ? "discordam" : "precisa_de_voce",
    texto: alertas.map((a) => textos[a]).join(" ").slice(0, 500) };
}
