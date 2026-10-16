/**
 * Transforma `[[ligações]]` em links Markdown (`[rótulo](#nota:<alvo>)`) no
 * *texto-fonte*, antes de o Markdown ser lido. Sem isso, `[[Nota]]` apareceria
 * como texto puro.
 *
 * Tem de ser no texto-fonte, e não num plugin que olha a árvore já pronta: o
 * leitor de Markdown interpreta `*`, `_` e `[` antes de qualquer plugin, então
 * `[[A*B*C]]` ou `[[_rascunho_]]` já chegariam partidos em vários nós. Aqui o
 * rótulo vai escapado e o resultado é um link comum, que o leitor entende. Código
 * (em linha ou em bloco) não é tocado — `extrairLigacoes` já o ignora.
 */

import { extrairLigacoes } from "./ligacoes";

/** Link para uma nota: `#nota:<alvo>` (e `#<seção>` no fim, quando a ligação tinha seção). */
export const PREFIXO_DE_NOTA = "#nota:";
/** Ligação para um arquivo que não é nota (imagem, PDF…): `#anexo:<nome>`. */
export const PREFIXO_DE_ANEXO = "#anexo:";

/** `encodeURIComponent` deixa passar `( ) ! * ' ~`, e os parênteses fechariam o destino do link antes da hora. */
function codificar(texto: string): string {
  return encodeURIComponent(texto).replace(/[()!*'~]/g, (letra) => `%${letra.charCodeAt(0).toString(16).toUpperCase()}`);
}

/** O rótulo é texto livre (um apelido pode ter qualquer coisa): o que o Markdown leria como sintaxe leva barra invertida. */
function escaparRotulo(texto: string): string {
  return texto.replace(/[\\`*_~<>&|[\]]/g, "\\$&");
}

export function ligacoesComoLinks(texto: string): string {
  let resultado = "";
  let cursor = 0;

  for (const ligacao of extrairLigacoes(texto)) {
    // A `!` de embutida fica logo antes do `[[` e sai junto com a ligação.
    const inicio = ligacao.embutida ? ligacao.inicio - 1 : ligacao.inicio;
    resultado += texto.slice(cursor, inicio);

    if (ligacao.anexo) {
      resultado += `[${escaparRotulo(ligacao.alvo)}](${PREFIXO_DE_ANEXO}${codificar(ligacao.alvo)})`;
    } else {
      const rotulo = ligacao.apelido ?? (ligacao.secao ? `${ligacao.alvo} › ${ligacao.secao}` : ligacao.alvo);
      const secao = ligacao.secao ? `#${codificar(ligacao.secao)}` : "";
      resultado += `[${escaparRotulo(rotulo)}](${PREFIXO_DE_NOTA}${codificar(ligacao.alvo)}${secao})`;
    }
    cursor = ligacao.fim;
  }

  return resultado + texto.slice(cursor);
}
