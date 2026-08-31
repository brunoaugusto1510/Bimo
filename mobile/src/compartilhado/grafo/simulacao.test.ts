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

describe("layout resultante (14 notas, como o vault de exemplo)", () => {
  const LARGURA_REAL = 400;
  const ALTURA_REAL = 800;

  function grafoDeExemplo(): NoDoGrafo[] {
    // Mesma distribuição que `montarGrafo` produz: círculo com raio embaralhado.
    return Array.from({ length: 14 }, (_, i) => {
      const angulo = (i / 14) * Math.PI * 2;
      const distancia = 0.2 + ((i * 37) % 100) / 100 * 0.3;
      return {
        id: `n${i}`,
        titulo: `Nota ${i}`,
        x: 0.5 + Math.cos(angulo) * distancia,
        y: 0.5 + Math.sin(angulo) * distancia,
        peso: 0.6 + (i % 5) * 0.3,
      };
    });
  }

  function estabilizar() {
    const estado = criarSimulacao(
      grafoDeExemplo(),
      [
        { de: "n0", para: "n1" }, { de: "n1", para: "n2" }, { de: "n2", para: "n3" },
        { de: "n0", para: "n5" }, { de: "n5", para: "n8" }, { de: "n8", para: "n11" },
        { de: "n3", para: "n7" }, { de: "n7", para: "n12" },
      ],
      LARGURA_REAL,
      ALTURA_REAL,
    );
    for (let i = 0; i < 600; i += 1) avancarSimulacao(estado, 16.67);
    return estado;
  }

  function raioVisual(peso: number) {
    return peso * 5.5;
  }

  it("nenhum par de nós fica sobreposto", () => {
    // Sem uma força de colisão, dois nós podem repousar no mesmo ponto: a
    // repulsão cai com o quadrado da distância e a mola vence de perto.
    const estado = estabilizar();

    for (let a = 0; a < estado.nos.length; a += 1) {
      for (let b = a + 1; b < estado.nos.length; b += 1) {
        const distancia = Math.hypot(estado.nos[a].x - estado.nos[b].x, estado.nos[a].y - estado.nos[b].y);
        const encostado = raioVisual(estado.nos[a].peso) + raioVisual(estado.nos[b].peso);
        expect(distancia).toBeGreaterThan(encostado);
      }
    }
  });

  it("o grafo ocupa a tela em vez de virar um novelo no centro", () => {
    // "Muito agrupado" em números: a nuvem precisa ter largura de verdade.
    const estado = estabilizar();
    const xs = estado.nos.map((no) => no.x);
    const ys = estado.nos.map((no) => no.y);

    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(LARGURA_REAL * 0.5);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(LARGURA_REAL * 0.5);
  });

  it("mas não explode para fora da tela", () => {
    const estado = estabilizar();

    for (const no of estado.nos) {
      expect(Math.hypot(no.x - LARGURA_REAL / 2, no.y - ALTURA_REAL / 2)).toBeLessThan(LARGURA_REAL);
    }
  });

  it("nós ligados continuam mais perto entre si que a média geral", () => {
    // A repulsão maior não pode apagar o sinal do grafo: vizinho tem que
    // continuar parecendo vizinho.
    const estado = estabilizar();

    const distanciaDe = (a: number, b: number) =>
      Math.hypot(estado.nos[a].x - estado.nos[b].x, estado.nos[a].y - estado.nos[b].y);

    const ligadas = estado.ligacoes.map(([a, b]) => distanciaDe(a, b));
    const mediaLigadas = ligadas.reduce((soma, d) => soma + d, 0) / ligadas.length;

    const todas: number[] = [];
    for (let a = 0; a < estado.nos.length; a += 1) {
      for (let b = a + 1; b < estado.nos.length; b += 1) todas.push(distanciaDe(a, b));
    }
    const mediaTodas = todas.reduce((soma, d) => soma + d, 0) / todas.length;

    expect(mediaLigadas).toBeLessThan(mediaTodas);
  });
});
