import { describe, expect, it } from "vitest";
import {
  construirIndiceDeLigacoes,
  encontrarMencoesSemLigacao,
  type NotaComConteudo,
} from "./indice-de-ligacoes";

function nota(id: string, titulo: string, conteudo: string, pasta: string | null = null): NotaComConteudo {
  return { id, titulo, pasta, conteudo };
}

describe("construirIndiceDeLigacoes", () => {
  it("liga cada nota às notas que ela cita, contando cada destino uma vez", () => {
    const indice = construirIndiceDeLigacoes([
      nota("1", "A", "[[B]] de novo [[B|apelido]] e [[B#Seção]]"),
      nota("2", "B", "volta para [[A]]"),
    ]);

    expect(indice.saidas.get("1")).toEqual([{ tipo: "nota", id: "2", titulo: "B", pasta: null, ambigua: false }]);
    expect(indice.saidas.get("2")).toEqual([{ tipo: "nota", id: "1", titulo: "A", pasta: null, ambigua: false }]);
  });

  it("toda nota tem uma lista de saídas, mesmo vazia", () => {
    const indice = construirIndiceDeLigacoes([nota("1", "A", "sem links")]);

    expect(indice.saidas.get("1")).toEqual([]);
    expect(indice.entradas.get("1")).toBeUndefined();
  });

  it("guarda as ligações que não resolvem, juntando grafias diferentes", () => {
    const indice = construirIndiceDeLigacoes([
      nota("1", "A", "[[Fantasma]] e [[fantasma]] e [[Pasta/Outro Fantasma.md]]"),
    ]);

    expect(indice.saidas.get("1")).toEqual([
      { tipo: "nao-resolvida", alvo: "Fantasma", titulo: "Fantasma" },
      { tipo: "nao-resolvida", alvo: "Pasta/Outro Fantasma", titulo: "Outro Fantasma" },
    ]);
  });

  it("ignora auto-ligações, anexos e ligações dentro de código", () => {
    const indice = construirIndiceDeLigacoes([
      nota("1", "A", "[[A]] ![[foto.png]] [[doc.pdf]] `[[B]]`"),
      nota("2", "B", ""),
    ]);

    expect(indice.saidas.get("1")).toEqual([]);
  });

  it("marca como ambígua a ligação para um título repetido e escolhe a nota da mesma pasta", () => {
    const indice = construirIndiceDeLigacoes([
      nota("1", "Origem", "[[Resumo]]", "Leituras"),
      nota("2", "Resumo", "", "Faculdade"),
      nota("3", "Resumo", "", "Leituras"),
    ]);

    expect(indice.saidas.get("1")).toEqual([
      { tipo: "nota", id: "3", titulo: "Resumo", pasta: "Leituras", ambigua: true },
    ]);
  });

  it("monta as entradas: quem cita a nota, com o trecho em volta do primeiro link", () => {
    const indice = construirIndiceDeLigacoes([
      nota("1", "A", "Antes do link, vamos ao [[B]] e seguimos adiante. Depois [[B]] outra vez.", "Pasta"),
      nota("2", "B", ""),
      nota("3", "C", "[[B]]"),
    ]);

    const entradas = indice.entradas.get("2");
    expect(entradas?.map((e) => e.id)).toEqual(["1", "3"]);
    expect(entradas?.[0]).toMatchObject({ id: "1", titulo: "A", pasta: "Pasta" });
    expect(entradas?.[0].trecho).toContain("[[B]]");
    expect(entradas?.[0].trecho).toContain("Antes do link");
  });

  it("ligações não resolvidas não geram entradas", () => {
    const indice = construirIndiceDeLigacoes([nota("1", "A", "[[Fantasma]]")]);

    expect(indice.entradas.size).toBe(0);
  });
});

describe("notas com ligações em massa", () => {
  it("monta o índice e as menções de uma nota com dezenas de milhares de ligações em tempo razoável", () => {
    const hostil = nota("1", "Hostil", "[[a]] ".repeat(60_000) + "[[x/y]] ".repeat(60_000));
    const alvo = nota("2", "a", "");

    const inicio = performance.now();
    const indice = construirIndiceDeLigacoes([hostil, alvo]);
    encontrarMencoesSemLigacao(hostil, [hostil, alvo], indice);

    expect(performance.now() - inicio).toBeLessThan(2000);
    expect(indice.saidas.get("1")).toHaveLength(2);
  });
});

describe("encontrarMencoesSemLigacao", () => {
  const notas = [
    nota("1", "Café: variáveis", ""),
    nota("2", "Notas atômicas", ""),
    nota("3", "Ler", ""),
    nota("4", "Hábito", "Tomei café: variáveis demais. Sobre notas atômicas, falei de notas atômicas e de [[Ler]]."),
  ];
  const indice = construirIndiceDeLigacoes(notas);
  const atual = notas[3];

  it("acha títulos citados no texto sem ligação, do mais ao menos citado", () => {
    const mencoes = encontrarMencoesSemLigacao(atual, notas, indice);

    expect(mencoes.map((m) => ({ id: m.id, ocorrencias: m.ocorrencias }))).toEqual([
      { id: "2", ocorrencias: 2 },
      { id: "1", ocorrencias: 1 },
    ]);
  });

  it("não sugere o que já está ligado, nem a própria nota", () => {
    const ids = encontrarMencoesSemLigacao(atual, notas, indice).map((m) => m.id);

    expect(ids).not.toContain("3");
    expect(ids).not.toContain("4");
  });

  it("só conta palavra inteira e ignora títulos muito curtos", () => {
    const outras = [nota("1", "Rede", ""), nota("2", "Ia", ""), nota("3", "X", "Redes e sua ia; a rede é boa. Hia.")];
    const mencoes = encontrarMencoesSemLigacao(outras[2], outras, construirIndiceDeLigacoes(outras));

    expect(mencoes.map((m) => m.id)).toEqual(["1"]);
    expect(mencoes[0].ocorrencias).toBe(1);
  });

  it("respeita o limite", () => {
    expect(encontrarMencoesSemLigacao(atual, notas, indice, 1)).toHaveLength(1);
  });
});
