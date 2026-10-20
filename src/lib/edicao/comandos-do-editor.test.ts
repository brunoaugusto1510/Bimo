import { describe, expect, it } from "vitest";
import { aplicarComando, COMANDOS, type IdDoComando } from "./comandos-do-editor";

/** A barra vertical marca o cursor nos textos de entrada e de saída. */
function conferir(entrada: string, id: IdDoComando, esperado: string) {
  const cursor = entrada.indexOf("¦");
  const texto = entrada.replace("¦", "");
  const inicio = texto.lastIndexOf("/", cursor - 1);
  const edicao = aplicarComando(texto, inicio, cursor, id);
  expect(texto.slice(0, edicao.de) + edicao.texto + texto.slice(edicao.ate))
    .toBe(esperado.replace("¦", ""));
  expect(edicao.cursor).toBe(esperado.indexOf("¦"));
  expect(edicao.ate).toBe(cursor);
  return edicao;
}

const prefixos = [
  ["titulo-1", "# "], ["titulo-2", "## "], ["titulo-3", "### "],
  ["lista", "- "], ["numerada", "1. "], ["tarefa", "- [ ] "], ["citacao", "> "],
] as const;

describe("COMANDOS", () => {
  it("expõe os dez comandos na ordem do menu, com nomes e detalhes em pt-BR", () => {
    expect(COMANDOS).toEqual([
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
    ]);
  });
});

describe("aplicarComando: prefixos", () => {
  it.each(prefixos)("aplica %s com consulta vazia na primeira linha", (id, prefixo) => {
    expect(conferir("/¦", id, `${prefixo}¦`).de).toBe(0);
  });

  it.each(prefixos)("preserva espaços e tabs ao aplicar %s", (id, prefixo) => {
    conferir(" \t  /consulta¦", id, ` \t  ${prefixo}¦`);
  });

  it.each(prefixos)("mantém %s idempotente", (id, prefixo) => {
    conferir(`${prefixo}item /consulta¦`, id, `${prefixo}item¦`);
  });

  it.each(["# ", "## ", "### ", "#### ", "##### ", "###### ", "- [ ] ", "- [x] ", "- ", "* ", "+ ", "12. ", "23) ", "> "])(
    "substitui o prefixo %j depois do recuo", (prefixo) => {
      conferir(`  ${prefixo}item /tarefa¦`, "tarefa", "  - [ ] item¦");
    },
  );

  it.each([
    ["texto /lista¦", "- texto¦"],
    ["texto   /li¦depois", "- texto ¦depois"],
    ["texto /li¦ depois", "- texto¦ depois"],
    ["texto /li¦\tdepois", "- texto¦\tdepois"],
    ["/li¦depois", "- ¦depois"],
    ["  /li¦depois", "  - ¦depois"],
    ["## /li¦depois", "- ¦depois"],
    ["/li¦## Título", "- ¦## Título"],
    ["####### texto /li¦", "- ####### texto¦"],
    ["#sem espaço /li¦", "- #sem espaço¦"],
    ["Olá😀 /li¦fim", "- Olá😀 ¦fim"],
  ])("transforma a linha %j e mantém o sufixo", (entrada, esperado) => {
    conferir(entrada, "lista", esperado);
  });

  it("limita a troca à linha atual até o cursor, sem alterar outras linhas", () => {
    const edicao = conferir("antes\n\t## Título /ti¦ fim\ndepois", "titulo-1", "antes\n\t# Título¦ fim\ndepois");
    expect(edicao.de).toBe(6);
  });
});

describe("aplicarComando: blocos", () => {
  it.each([
    ["/¦", "```\n¦\n```"],
    ["  /cod¦", "  ```\n  ¦\n  ```"],
    ["texto   /cod¦", "texto\n```\n¦\n```"],
    ["\ttexto /cod¦resto", "\ttexto\n\t```\n\t¦\n\t```\nresto"],
    ["antes\n  /cod¦\ndepois", "antes\n  ```\n  ¦\n  ```\ndepois"],
    // O resto da linha vai para baixo da cerca: colado nela, a cerca deixaria de fechar o bloco.
    ["x\n/co¦ resto", "x\n```\n¦\n```\n resto"],
    // Só o prefixo de lista, tarefa ou citação não é conteúdo: o bloco ocupa o lugar dele, sem deixar "-" órfão.
    ["x\n- /c¦", "x\n```\n¦\n```"],
    ["x\n> /c¦", "x\n```\n¦\n```"],
    ["x\n- [ ] /c¦", "x\n```\n¦\n```"],
  ])("insere código em %j", (entrada, esperado) => {
    conferir(entrada, "codigo", esperado);
  });

  it.each([
    // Na primeira linha `---` abriria um frontmatter e desligaria o autocompletar da nota inteira.
    ["/¦", "***\n¦"],
    ["  /div¦", "  ***\n¦"],
    ["texto /div¦", "texto\n\n---\n¦"],
    ["x\n- /div¦", "x\n\n---\n¦"],
    ["antes\n/div¦", "antes\n\n---\n¦"],
    ["antes\n\n/div¦", "antes\n\n---\n¦"],
    ["antes\n \t\n/div¦", "antes\n \t\n---\n¦"],
    ["texto   /div¦", "texto\n\n---\n¦"],
    ["antes\n\ttexto /div¦resto\ndepois", "antes\n\ttexto\n\n\t---\n¦resto\ndepois"],
    ["antes\n  /div¦\ndepois", "antes\n\n  ---\n¦\ndepois"],
  ])("insere divisor sem criar título setext em %j", (entrada, esperado) => {
    conferir(entrada, "divisor", esperado);
  });

  const tabela = "| ¦Coluna 1 | Coluna 2 |\n| --- | --- |\n|  |  |\n|  |  |";

  it.each([
    ["/¦", tabela],
    ["  /tab¦", tabela.split("\n").map((linha) => `  ${linha}`).join("\n")],
    ["texto   /tab¦", `texto\n\n${tabela}`],
    ["\ttexto /tab¦resto", `\ttexto\n\n${tabela.split("\n").map((linha) => `\t${linha}`).join("\n")}\nresto`],
    ["antes\n/tab¦\ndepois", `antes\n${tabela}\ndepois`],
    ["x\n- [ ] /t¦", `x\n${tabela}`],
  ])("insere tabela 2×2 e posiciona no primeiro cabeçalho em %j", (entrada, esperado) => {
    conferir(entrada, "tabela", esperado);
  });

  it("deixa o rótulo do primeiro cabeçalho selecionado, para digitar por cima dele", () => {
    const edicao = conferir("antes\n/tab¦", "tabela", `antes\n${tabela}`);
    expect(edicao.selecaoAte).toBe(edicao.cursor + "Coluna 1".length);
  });
});

describe("aplicarComando: espaço depois da barra e prefixos em maiúscula", () => {
  it("/ texto: o espaço que separava a barra do texto não vira dois", () => {
    const texto = "/ texto";
    const edicao = aplicarComando(texto, 0, 1, "titulo-1");
    expect(texto.slice(0, edicao.de) + edicao.texto + texto.slice(edicao.ate)).toBe("# texto");
    expect(edicao.cursor).toBe(2);
  });
  it("reconhece a tarefa marcada com X maiúsculo", () => {
    conferir("- [X] feito /lista¦", "lista", "- feito¦");
  });
});
