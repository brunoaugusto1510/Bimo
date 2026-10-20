import type { Edicao } from "./insercao-no-editor";

export type IdDoComando = "titulo-1" | "titulo-2" | "titulo-3" | "lista" | "numerada" | "tarefa" | "citacao" | "codigo" | "divisor" | "tabela";
export type ComandoDoEditor = { id: IdDoComando; titulo: string; detalhe: string };

/** Ordem de apresentação no menu; os detalhes mostram a sintaxe inserida. */
export const COMANDOS: readonly ComandoDoEditor[] = [
  { id: "titulo-1", titulo: "Título 1", detalhe: "# " },
  { id: "titulo-2", titulo: "Título 2", detalhe: "## " },
  { id: "titulo-3", titulo: "Título 3", detalhe: "### " },
  { id: "lista", titulo: "Lista", detalhe: "- " },
  { id: "numerada", titulo: "Lista numerada", detalhe: "1. " },
  { id: "tarefa", titulo: "Tarefa", detalhe: "- [ ] " },
  { id: "citacao", titulo: "Citação", detalhe: "> " },
  { id: "codigo", titulo: "Bloco de código", detalhe: "```" },
  { id: "divisor", titulo: "Divisor", detalhe: "---" },
  { id: "tabela", titulo: "Tabela", detalhe: "2×2" },
];

const PREFIXOS = {
  "titulo-1": "# ", "titulo-2": "## ", "titulo-3": "### ",
  lista: "- ", numerada: "1. ", tarefa: "- [ ] ", citacao: "> ",
};

const PREFIXO_EXISTENTE = /^(?:#{1,6} |- \[[ xX]\] |[-*+] |\d+[.)] |> )/;
const ROTULO_DO_CABECALHO = "Coluna 1";

/** Planeja a troca até o cursor, preservando o texto que vem depois dele. */
export function aplicarComando(texto: string, inicio: number, cursor: number, id: IdDoComando): Edicao {
  const inicioDaLinha = texto.lastIndexOf("\n", inicio - 1) + 1;
  const antes = texto.slice(inicioDaLinha, inicio);
  const recuo = antes.match(/^[ \t]*/)![0];
  // O que sobra depois do recuo e de um prefixo de bloco (`- `, `> `): só o prefixo não é conteúdo.
  const semPrefixo = antes.slice(recuo.length).replace(PREFIXO_EXISTENTE, "");
  const temConteudo = semPrefixo.trim() !== "";
  const fimDaLinha = texto.indexOf("\n", cursor);
  const depois = texto.slice(cursor, fimDaLinha === -1 ? texto.length : fimDaLinha);
  // Um bloco (código, tabela) não pode ter o resto da linha colado no fim: ele passa para a linha de baixo.
  const empurraOResto = depois.trim() !== "" ? "\n" : "";

  if (id !== "codigo" && id !== "divisor" && id !== "tabela") {
    // Remove o prefixo antes de aparar os espaços, pois eles fazem parte da sintaxe.
    const conteudo = semPrefixo.trimEnd();
    const separador = conteudo && depois && !/^[ \t]/.test(depois) ? " " : "";
    const insercao = recuo + PREFIXOS[id] + conteudo + separador;
    // `/ texto` (sem conteúdo antes): o espaço que separava a barra do texto some, senão ficariam dois.
    const espacoDeSobra = conteudo === "" && /^[ \t]/.test(depois) ? 1 : 0;
    return { de: inicioDaLinha, ate: cursor + espacoDeSobra, texto: insercao, cursor: inicioDaLinha + insercao.length };
  }

  if (id === "codigo") {
    const abertura = (temConteudo ? antes.trimEnd() + "\n" : "") + recuo + "```\n" + recuo;
    return {
      de: inicioDaLinha, ate: cursor,
      texto: abertura + "\n" + recuo + "```" + empurraOResto,
      cursor: inicioDaLinha + abertura.length,
    };
  }

  if (id === "divisor") {
    const linhaAnterior = texto.slice(0, Math.max(0, inicioDaLinha - 1)).split("\n").at(-1) ?? "";
    const antesDoDivisor = temConteudo
      ? antes.trimEnd() + "\n\n"
      : inicioDaLinha > 0 && linhaAnterior.trim() ? "\n" : "";
    // `---` na primeira linha abriria um frontmatter (e desligaria o autocompletar da nota): lá vai `***`, que também é um divisor.
    const marca = inicioDaLinha === 0 && !temConteudo ? "***" : "---";
    const insercao = antesDoDivisor + recuo + marca + "\n";
    return { de: inicioDaLinha, ate: cursor, texto: insercao, cursor: inicioDaLinha + insercao.length };
  }

  const antesDaTabela = temConteudo ? antes.trimEnd() + "\n\n" : "";
  const tabela = [`| ${ROTULO_DO_CABECALHO} | Coluna 2 |`, "| --- | --- |", "|  |  |", "|  |  |"]
    .map((linha) => recuo + linha).join("\n");
  const inicioDoRotulo = inicioDaLinha + antesDaTabela.length + recuo.length + "| ".length;
  return {
    de: inicioDaLinha, ate: cursor, texto: antesDaTabela + tabela + empurraOResto,
    cursor: inicioDoRotulo,
    // O rótulo do cabeçalho fica selecionado: digitar o troca, em vez de grudar no "Coluna 1".
    selecaoAte: inicioDoRotulo + ROTULO_DO_CABECALHO.length,
  };
}
