import type { Aresta, NoDoGrafo } from "@/dados/tipos";
import {
  avancarSimulacao,
  criarSimulacao,
  esfriou,
  fixarNo,
  liberarNo,
  reaquecer,
  type EstadoSimulacao,
} from "./simulacao";

const LARGURA = 400;
const ALTURA = 800;

function doisNos(): NoDoGrafo[] {
  return [
    { id: "a", titulo: "A", x: 0.2, y: 0.5, peso: 1 },
    { id: "b", titulo: "B", x: 0.8, y: 0.5, peso: 1 },
  ];
}

function distancia(estado: EstadoSimulacao): number {
  return Math.hypot(estado.nos[0].x - estado.nos[1].x, estado.nos[0].y - estado.nos[1].y);
}

function avancar(estado: EstadoSimulacao, passos: number) {
  for (let i = 0; i < passos; i += 1) avancarSimulacao(estado, 16.67);
}

describe("criarSimulacao", () => {
  it("posiciona os nós em pixels, não nas coordenadas normalizadas", () => {
    const estado = criarSimulacao(doisNos(), [], LARGURA, ALTURA);
    expect(estado.nos[0].x).toBeGreaterThan(1);
    expect(estado.nos.every((no) => no.fixo === false)).toBe(true);
  });

  it("resolve as arestas para índices uma única vez", () => {
    const arestas: Aresta[] = [{ de: "a", para: "b" }];
    expect(criarSimulacao(doisNos(), arestas, LARGURA, ALTURA).ligacoes).toEqual([[0, 1]]);
  });

  it("descarta aresta cuja ponta não existe entre os nós", () => {
    const arestas: Aresta[] = [{ de: "a", para: "sumiu" }];
    expect(criarSimulacao(doisNos(), arestas, LARGURA, ALTURA).ligacoes).toEqual([]);
  });
});

describe("avancarSimulacao", () => {
  it("a mola aproxima nós ligados e distantes", () => {
    const estado = criarSimulacao(doisNos(), [{ de: "a", para: "b" }], LARGURA, ALTURA);
    const antes = distancia(estado);
    avancar(estado, 60);
    expect(distancia(estado)).toBeLessThan(antes);
  });

  it("a repulsão afasta nós sobrepostos e sem ligação", () => {
    const nos: NoDoGrafo[] = [
      { id: "a", titulo: "A", x: 0.5, y: 0.5, peso: 1 },
      { id: "b", titulo: "B", x: 0.5, y: 0.5, peso: 1 },
    ];
    const estado = criarSimulacao(nos, [], LARGURA, ALTURA);
    avancar(estado, 30);
    expect(distancia(estado)).toBeGreaterThan(0);
  });

  it("muta o estado recebido em vez de devolver um novo", () => {
    // A mutação in-place é deliberada: a 120 Hz, alocar um array de nós por
    // quadro gera lixo que o GC recolhe 120 vezes por segundo.
    const estado = criarSimulacao(doisNos(), [], LARGURA, ALTURA);
    const mesmoArray = estado.nos;
    const mesmoNo = estado.nos[0];
    avancar(estado, 1);
    expect(estado.nos).toBe(mesmoArray);
    expect(estado.nos[0]).toBe(mesmoNo);
  });

  it("o alpha decai e a simulação esfria", () => {
    const estado = criarSimulacao(doisNos(), [], LARGURA, ALTURA);
    expect(esfriou(estado)).toBe(false);
    avancar(estado, 400);
    expect(esfriou(estado)).toBe(true);
  });
});

describe("nó fixo", () => {
  it("não se move nem acumula velocidade enquanto está fixo", () => {
    const estado = criarSimulacao(doisNos(), [{ de: "a", para: "b" }], LARGURA, ALTURA);
    fixarNo(estado, "a", 123, 456);
    avancar(estado, 30);
    expect(estado.nos[0].x).toBe(123);
    expect(estado.nos[0].y).toBe(456);
    expect(estado.nos[0].vx).toBe(0);
  });

  it("volta a se mover depois de liberado", () => {
    const estado = criarSimulacao(doisNos(), [{ de: "a", para: "b" }], LARGURA, ALTURA);
    fixarNo(estado, "a", 123, 456);
    avancar(estado, 5);
    liberarNo(estado, "a");
    reaquecer(estado, 0.3);
    avancar(estado, 30);
    expect(estado.nos[0].x).not.toBe(123);
  });

  it("fixar um id que não existe não quebra", () => {
    const estado = criarSimulacao(doisNos(), [], LARGURA, ALTURA);
    expect(() => fixarNo(estado, "sumiu", 1, 2)).not.toThrow();
  });
});

describe("reaquecer", () => {
  it("devolve alpha a um grafo já frio", () => {
    const estado = criarSimulacao(doisNos(), [], LARGURA, ALTURA);
    avancar(estado, 400);
    reaquecer(estado, 0.3);
    expect(esfriou(estado)).toBe(false);
  });

  it("nunca reduz o alpha de um grafo ainda quente", () => {
    const estado = criarSimulacao(doisNos(), [], LARGURA, ALTURA);
    reaquecer(estado, 0.3);
    expect(estado.alpha).toBe(1);
  });
});
