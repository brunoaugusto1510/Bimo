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
    ["\\[[A", 4], ["[[A]] texto", 11],
    ["`[[A`", 4], ["`[[A", 4], ["``[[A``", 5],
    ["```md\n[[A\n```", 9], ["~~~\n[[A\n~~~", 7], ["```\n[[A", 7],
    ["---\ntitulo: [[A\n---\ncorpo", 14], ["---\n[[A", 7],
    // Cursor no meio de uma ligação que já existe: não é digitação de uma nova, e inserir corromperia o resto dela.
    ["[[Nota]] depois", 4], ["[[Nota|apelido]]", 6], ["[[Nota#seção]]", 6], ["[[Minha nota]]", 5], ["[[A^bloco]]", 3],
  ])("recusa %j no cursor %i", (texto, cursor) => {
    expect(detectarGatilho(texto, cursor)).toBeNull();
  });

  describe("tag (#)", () => {
    it.each([
      ["#a", 2, 0, "a"],
      ["texto #ide", 10, 6, "ide"],
      ["antes\n#proj/sub-1", 17, 6, "proj/sub-1"],
      ["  #ação", 7, 2, "ação"],
      ["\t#x depois", 3, 1, "x"],
      ["#ide fim", 4, 0, "ide"],
    ])("detecta a consulta em %j no cursor %i", (texto, cursor, inicio, consulta) => {
      expect(detectarGatilho(texto, cursor)).toEqual({ tipo: "tag", inicio, consulta });
    });
    it.each([
      ["#", 1], ["# ", 2], ["# Título", 8], ["## Título", 9], ["##a", 3], ["###", 3],
      ["texto#a", 7], ["http://x.com/#frag", 18], ["a #", 3],
      ["#ide", 3],
      ["`#a`", 3], ["`texto #a", 9], ["```\n#a\n```", 6], ["---\n#a\n---\ncorpo", 6],
      ["#a,b", 4],
      // Número puro (#123, a #1) não é tag, como em `ehTagValida`: issue, página, item.
      ["issue #123", 10], ["a #1", 4], ["#2024/12", 8],
    ])("recusa %j no cursor %i", (texto, cursor) => {
      expect(detectarGatilho(texto, cursor)).toBeNull();
    });
    it("uma tag com número e letra continua valendo (#fff, #2024/q1)", () => {
      expect(detectarGatilho("cor #fff", 8)).toEqual({ tipo: "tag", inicio: 4, consulta: "fff" });
      expect(detectarGatilho("#2024/q1", 8)).toEqual({ tipo: "tag", inicio: 0, consulta: "2024/q1" });
    });
    it("a ligação aberta na linha vence: dentro de [[ o # separa a seção, não abre tag", () => {
      expect(detectarGatilho("[[Nota #x", 9)).toEqual({ tipo: "ligacao", inicio: 0, consulta: "Nota #x" });
    });
    it("depois de uma ligação fechada, volta a valer", () => {
      expect(detectarGatilho("[[A]] #x", 8)).toEqual({ tipo: "tag", inicio: 6, consulta: "x" });
    });
    it("dentro do apelido de uma ligação ainda aberta ([[Nota|apelido #x) não abre tag nem comando", () => {
      expect(detectarGatilho("[[Nota|apelido #x", 17)).toBeNull();
      expect(detectarGatilho("[[Nota|apelido /li", 18)).toBeNull();
    });
  });

  describe("comando (/)", () => {
    it.each([
      ["/", 1, 0, ""],
      ["/tit", 4, 0, "tit"],
      ["  /lista", 8, 2, "lista"],
      ["texto /tab", 10, 6, "tab"],
      ["antes\n/cit", 10, 6, "cit"],
      ["/Título", 7, 0, "Título"],
      ["/tit fim", 4, 0, "tit"],
    ])("detecta a consulta em %j no cursor %i", (texto, cursor, inicio, consulta) => {
      expect(detectarGatilho(texto, cursor)).toEqual({ tipo: "comando", inicio, consulta });
    });
    it.each([
      ["e/ou", 3], ["1/2", 3], ["http://x", 6], ["a//b", 3], ["/tit ", 5], ["/tit x", 6], ["/a1", 3],
      ["/tit", 3], ["`/lista`", 7], ["```\n/lista\n```", 10], ["---\n/x\n---\nc", 6],
      // A barra sozinha no meio da frase ("Sim /", "e / ou") não abre o menu: ele sequestraria as setas e o Enter.
      ["Sim /", 5], ["texto\n  texto /", 15], ["a  /", 4],
    ])("recusa %j no cursor %i", (texto, cursor) => {
      expect(detectarGatilho(texto, cursor)).toBeNull();
    });
    it("a barra sozinha abre o menu só no começo da linha (depois do recuo)", () => {
      expect(detectarGatilho("antes\n/", 7)).toEqual({ tipo: "comando", inicio: 6, consulta: "" });
      expect(detectarGatilho("  \t/", 4)).toEqual({ tipo: "comando", inicio: 3, consulta: "" });
    });
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
