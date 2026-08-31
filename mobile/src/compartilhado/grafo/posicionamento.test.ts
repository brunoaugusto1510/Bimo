import { noMaisProximoDeCoordenada, paraCoordenadaDoGrafo, posicionarNo, raioDoNo } from "./posicionamento";
import type { NoDoGrafo } from "@/dados/tipos";

const LARGURA = 402;
const ALTURA = 700;

const nos: NoDoGrafo[] = [
  { id: "a", titulo: "A", x: 0.5, y: 0.5, peso: 1.4 },
  { id: "b", titulo: "B", x: 0.2, y: 0.2, peso: 0.8 },
];

describe("posicionarNo", () => {
  it("mapeia 0,5 / 0,5 para o centro da tela", () => {
    const { x, y } = posicionarNo(nos[0], LARGURA, ALTURA);
    expect(x).toBeCloseTo(LARGURA / 2);
    expect(y).toBeCloseTo(ALTURA / 2);
  });

  it("mapeia coordenadas normalizadas para centro ± raio × 1,05", () => {
    const { x } = posicionarNo({ ...nos[0], x: 1 }, LARGURA, ALTURA);
    const raio = Math.min(LARGURA, ALTURA) * 0.62 * 1.05;
    expect(x).toBeCloseTo(LARGURA / 2 + raio);
  });
});

describe("raioDoNo", () => {
  it("é o peso vezes 5,5", () => {
    expect(raioDoNo(1.4)).toBeCloseTo(7.7);
  });
});

describe("paraCoordenadaDoGrafo", () => {
  it("desfaz o deslocamento", () => {
    expect(paraCoordenadaDoGrafo({ x: 150, y: 250 }, 1, { x: 50, y: 100 })).toEqual({ x: 100, y: 150 });
  });

  it("desfaz o zoom", () => {
    expect(paraCoordenadaDoGrafo({ x: 200, y: 100 }, 2, { x: 0, y: 0 })).toEqual({ x: 100, y: 50 });
  });

  it("desfaz deslocamento e zoom na ordem certa", () => {
    // A camada aplica translate e só depois scale; desfazer na ordem errada
    // erra o alvo por um fator do zoom — é aqui que o hit-test fura na prática.
    expect(paraCoordenadaDoGrafo({ x: 250, y: 100 }, 2, { x: 50, y: 20 })).toEqual({ x: 100, y: 40 });
  });
});

describe("noMaisProximoDeCoordenada", () => {
  const posicoes = [
    { x: 100, y: 100 },
    { x: 300, y: 300 },
  ];
  const pesos = [1, 1];

  it("acha o nó sob o ponto", () => {
    expect(noMaisProximoDeCoordenada(posicoes, pesos, { x: 102, y: 98 })).toBe(0);
  });

  it("aceita um ponto a até raio + 10 px do centro do nó", () => {
    expect(noMaisProximoDeCoordenada(posicoes, pesos, { x: 100 + raioDoNo(1) + 9, y: 100 })).toBe(0);
  });

  it("devolve null longe de qualquer nó", () => {
    expect(noMaisProximoDeCoordenada(posicoes, pesos, { x: 800, y: 800 })).toBeNull();
  });

  it("escolhe o mais próximo quando dois alvos se sobrepõem", () => {
    expect(
      noMaisProximoDeCoordenada([{ x: 100, y: 100 }, { x: 110, y: 100 }], pesos, { x: 109, y: 100 }),
    ).toBe(1);
  });

  it("aguenta grafo vazio", () => {
    expect(noMaisProximoDeCoordenada([], [], { x: 1, y: 2 })).toBeNull();
  });
});
