/**
 * Plugin do remark (o processador de Markdown do `react-markdown`) que
 * transforma `[[ligações]]` em links. Sem ele, `[[Nota]]` apareceria como texto
 * puro; com ele, vira um link `#nota:<alvo>` que o renderizador entende e
 * desvia para a navegação do espaço de trabalho.
 *
 * Mexe só em texto comum: código em linha, blocos de código e o que já está
 * dentro de um link ficam como estão. Sem dependência nova — percorre a árvore
 * à mão.
 */

import { extrairLigacoes } from "./ligacoes";

/** Um nó da árvore do Markdown (mdast), só com o que usamos. */
export type NoMdast = {
  type: string;
  value?: string;
  url?: string;
  children?: NoMdast[];
  [outro: string]: unknown;
};

/** Link para uma nota: `#nota:<alvo>` (e `#<seção>` no fim, quando a ligação tinha seção). */
export const PREFIXO_DE_NOTA = "#nota:";
/** Ligação para um arquivo que não é nota (imagem, PDF…): `#anexo:<nome>`. */
export const PREFIXO_DE_ANEXO = "#anexo:";

/** Os nós por dentro dos quais não se procura ligação. */
const NOS_QUE_NAO_SE_TOCA = new Set(["inlineCode", "code", "link", "linkReference", "html", "definition"]);

function paraNos(valor: string): NoMdast[] {
  const ligacoes = extrairLigacoes(valor);
  if (ligacoes.length === 0) return [{ type: "text", value: valor }];

  const nos: NoMdast[] = [];
  let cursor = 0;

  for (const ligacao of ligacoes) {
    // A `!` de embutida fica logo antes do `[[` e sai junto com a ligação.
    const inicio = ligacao.embutida ? ligacao.inicio - 1 : ligacao.inicio;
    if (inicio > cursor) nos.push({ type: "text", value: valor.slice(cursor, inicio) });

    if (ligacao.anexo) {
      nos.push({
        type: "link",
        url: `${PREFIXO_DE_ANEXO}${encodeURIComponent(ligacao.alvo)}`,
        children: [{ type: "text", value: ligacao.alvo }],
      });
    } else {
      const rotulo = ligacao.apelido ?? (ligacao.secao ? `${ligacao.alvo} › ${ligacao.secao}` : ligacao.alvo);
      nos.push({
        type: "link",
        url: `${PREFIXO_DE_NOTA}${encodeURIComponent(ligacao.alvo)}${ligacao.secao ? `#${encodeURIComponent(ligacao.secao)}` : ""}`,
        children: [{ type: "text", value: rotulo }],
      });
    }
    cursor = ligacao.fim;
  }

  if (cursor < valor.length) nos.push({ type: "text", value: valor.slice(cursor) });
  return nos;
}

function percorrer(no: NoMdast): void {
  if (!no.children || NOS_QUE_NAO_SE_TOCA.has(no.type)) return;

  no.children = no.children.flatMap((filho) => {
    if (filho.type === "text" && typeof filho.value === "string" && filho.value.includes("[[")) {
      return paraNos(filho.value);
    }
    percorrer(filho);
    return [filho];
  });
}

export function remarkLigacoes() {
  return (arvore: NoMdast) => percorrer(arvore);
}
