/**
 * O trecho da conversa que vai para o agente. `/api/chat` recusa mais de 40 mensagens ou 80 mil
 * caracteres (os mesmos limites de `historicoPermitido`, em `agente.ts`): uma conversa reaberta do
 * histórico pode passar disso, então o chat manda só o fim dela — o resto continua visível na tela.
 */

import type { Mensagem } from "./types";

const MAXIMO_DE_MENSAGENS = 40;
const MAXIMO_DE_CARACTERES = 80_000;

type ParaOAgente = Pick<Mensagem, "papel" | "conteudo">;

export function janelaParaOAgente(mensagens: ParaOAgente[]): ParaOAgente[] {
  const janela: ParaOAgente[] = [];
  let caracteres = 0;
  for (let i = mensagens.length - 1; i >= 0 && janela.length < MAXIMO_DE_MENSAGENS; i--) {
    const { papel, conteudo } = mensagens[i];
    // A pergunta atual (a última) entra sempre; o passado só enquanto couber.
    if (janela.length > 0 && caracteres + conteudo.length > MAXIMO_DE_CARACTERES) break;
    janela.unshift({ papel, conteudo });
    caracteres += conteudo.length;
  }
  // Uma resposta sem a pergunta que a causou só confunde o agente.
  while (janela.length > 1 && janela[0].papel === "agente") janela.shift();
  return janela;
}
