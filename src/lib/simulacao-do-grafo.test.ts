import { describe, expect, it } from "vitest";
import { CONFIGURACAO_PADRAO, calcularGraus } from "./fisica-do-grafo";
import type { ArestaDoGrafo, NoDoGrafo } from "./grafo-de-notas";
import { criarSimulacaoDoGrafo, montarVizinhos } from "./simulacao-do-grafo";

const NOS: NoDoGrafo[] = [
  { tipo: "nota", id: "A.md", titulo: "A", grupo: "Raiz" },
  { tipo: "nota", id: "B.md", titulo: "B", grupo: "Raiz" },
  { tipo: "nota", id: "C.md", titulo: "C", grupo: "Raiz" },
  { tipo: "tag", id: "tag:x", titulo: "#x" },
];

const ARESTAS: ArestaDoGrafo[] = [
  { de: "A.md", para: "B.md" },
  { de: "B.md", para: "C.md" },
  { de: "A.md", para: "tag:x" },
];

/** Gerador congruencial simples — o teste não pode depender de Math.random. */
function criarAleatorio(semente: number) {
  let estado = semente;
  return () => {
    estado = (estado * 1664525 + 1013904223) % 4294967296;
    return estado / 4294967296;
  };
}

function criar(nos = NOS, arestas = ARESTAS, extra: { passos?: number; semente?: number } = {}) {
  return criarSimulacaoDoGrafo({
    nos,
    arestas,
    configuracao: CONFIGURACAO_PADRAO,
    graus: calcularGraus(arestas),
    aleatorio: criarAleatorio(extra.semente ?? 1),
    passos: extra.passos,
  });
}

describe("montarVizinhos", () => {
  it("liga cada ponta da aresta à outra, nos dois sentidos", () => {
    const vizinhos = montarVizinhos(ARESTAS);

    expect([...(vizinhos.get("A.md") ?? [])].sort()).toEqual(["B.md", "tag:x"]);
    expect([...(vizinhos.get("B.md") ?? [])].sort()).toEqual(["A.md", "C.md"]);
    expect([...(vizinhos.get("tag:x") ?? [])]).toEqual(["A.md"]);
  });

  it("não repete vizinho quando há links nos dois sentidos", () => {
    const vizinhos = montarVizinhos([
      { de: "A.md", para: "B.md" },
      { de: "B.md", para: "A.md" },
    ]);

    expect(vizinhos.get("A.md")?.size).toBe(1);
  });

  it("não trata uma nota como vizinha de si mesma (link para si)", () => {
    const vizinhos = montarVizinhos([{ de: "A.md", para: "A.md" }]);

    expect(vizinhos.get("A.md")?.size ?? 0).toBe(0);
  });

  it("devolve um mapa vazio sem arestas", () => {
    expect(montarVizinhos([]).size).toBe(0);
  });
});

describe("criarSimulacaoDoGrafo", () => {
  it("cria um nó simulado por nó do grafo, com posição finita depois de acomodar", () => {
    const { nos } = criar();

    expect(nos).toHaveLength(NOS.length);
    for (const no of nos) {
      expect(Number.isFinite(no.x)).toBe(true);
      expect(Number.isFinite(no.y)).toBe(true);
    }
  });

  it("preserva os dados do nó original", () => {
    const { nos } = criar();

    expect(nos[0]).toMatchObject({ tipo: "nota", id: "A.md", titulo: "A", grupo: "Raiz" });
    expect(nos[3]).toMatchObject({ tipo: "tag", id: "tag:x" });
  });

  it("liga as arestas aos mesmos objetos dos nós (a simulação mexe neles no lugar)", () => {
    const { nos, links } = criar();

    expect(links).toHaveLength(ARESTAS.length);
    expect(links[0].source).toBe(nos[0]);
    expect(links[0].target).toBe(nos[1]);
  });

  it("descarta arestas cujas pontas não existem no grafo", () => {
    const { links } = criar(NOS, [...ARESTAS, { de: "A.md", para: "fantasma.md" }]);

    expect(links).toHaveLength(ARESTAS.length);
  });

  it("devolve a simulação já esfriada: o layout nasce pronto", () => {
    const { simulacao } = criar();

    expect(simulacao.alpha()).toBeLessThan(simulacao.alphaMin());
  });

  it("sem passos de acomodação, a simulação continua quente", () => {
    const { simulacao } = criar(NOS, ARESTAS, { passos: 0 });

    expect(simulacao.alpha()).toBe(1);
  });

  it("é reproduzível: o mesmo gerador aleatório dá o mesmo layout", () => {
    const primeira = criar(NOS, ARESTAS, { semente: 7 });
    const segunda = criar(NOS, ARESTAS, { semente: 7 });

    expect(primeira.nos.map((n) => [n.x, n.y])).toEqual(segunda.nos.map((n) => [n.x, n.y]));
  });

  it("aguenta um grafo vazio", () => {
    const { nos, links } = criar([], []);

    expect(nos).toEqual([]);
    expect(links).toEqual([]);
  });

  it("deixa fixar um nó (arrastar): o nó fixado não sai do lugar enquanto a simulação roda", () => {
    const { nos, simulacao } = criar(NOS, ARESTAS, { passos: 0 });
    nos[0].fx = 123;
    nos[0].fy = -45;

    simulacao.tick(50);

    expect(nos[0].x).toBe(123);
    expect(nos[0].y).toBe(-45);
  });
});
