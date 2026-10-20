import { describe, expect, it } from "vitest";
import { detectarGatilho } from "./gatilho-do-editor";

describe("detectarGatilho", () => {
  it.each([
    ["[[", 2, 0, ""],
    ["Veja [[Título#seção", 19, 5, "Título#seção"],
    ["antes\n[[Nota", 12, 6, "Nota"],
    ["[[A]] e [[B", 11, 8, "B"],
    ["[[No]] depois", 4, 0, "No"],
    ["[[No texto", 4, 0, "No"],
    ["😀 [[Olá", 8, 3, "Olá"],
    ["\\\\[[A", 5, 2, "A"],
  ])("detecta a consulta em %j no cursor %i", (texto, cursor, inicio, consulta) => {
    expect(detectarGatilho(texto, cursor)).toEqual({ tipo: "ligacao", inicio, consulta });
  });

  it.each([
    ["", 0], ["[[A", -1], ["[[A", 4], ["[[A", 1.5], ["[[A", NaN],
    ["texto", 5], ["[[A\nB", 5], ["[[A\rB", 5],
    ["[[A]B", 5], ["[[A[B", 5], ["[[A|B", 5],
    ["\\[[A", 4], ["[[A]] texto", 11], ["#tag", 4], ["/comando", 8],
    ["`[[A`", 4], ["`[[A", 4], ["``[[A``", 5],
    ["```md\n[[A\n```", 9], ["~~~\n[[A\n~~~", 7], ["```\n[[A", 7],
    ["---\ntitulo: [[A\n---\ncorpo", 14], ["---\n[[A", 7],
    // Cursor no meio de uma ligação que já existe: não é digitação de uma nova, e inserir corromperia o resto dela.
    ["[[Nota]] depois", 4], ["[[Nota|apelido]]", 6], ["[[Nota#seção]]", 6], ["[[Minha nota]]", 5], ["[[A^bloco]]", 3],
  ])("recusa %j no cursor %i", (texto, cursor) => {
    expect(detectarGatilho(texto, cursor)).toBeNull();
  });

  it.each([
    "---\ntitulo: exemplo\n---\n[[A",
    "---\r\ntitulo: exemplo\r\n---\r\n[[A",
    "```\n[[codigo\n```\n[[A",
    "~~~\n[[codigo\n~~~\n[[A",
    "`codigo` [[A",
    "``codigo ` literal`` [[A",
    "\\`literal [[A",
  ])("preserva o índice depois de frontmatter ou código: %j", (texto) => {
    expect(detectarGatilho(texto, texto.length)).toEqual({
      tipo: "ligacao", inicio: texto.lastIndexOf("[["), consulta: "A",
    });
  });
});
