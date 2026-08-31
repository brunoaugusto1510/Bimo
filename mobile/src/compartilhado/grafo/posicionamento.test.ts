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
  const CENTRO = { x: 200, y: 400 };

  it("sem zoom nem deslocamento, o ponto é ele mesmo", () => {
    expect(paraCoordenadaDoGrafo({ x: 150, y: 250 }, 1, { x: 0, y: 0 }, CENTRO)).toEqual({ x: 150, y: 250 });
  });

  it("desfaz o deslocamento", () => {
    expect(paraCoordenadaDoGrafo({ x: 150, y: 250 }, 1, { x: 50, y: 100 }, CENTRO)).toEqual({ x: 100, y: 150 });
  });

  it("o centro da tela não se move com o zoom", () => {
    // O React Native escala a partir do centro da view, não do canto. É por
    // isso que a conta precisa do centro: sem ele, o erro é de
    // centro × (1 - 1/zoom) — dezenas de pixels — e o toque longo acerta
    // sempre o lugar errado depois de qualquer zoom.
    expect(paraCoordenadaDoGrafo(CENTRO, 2, { x: 0, y: 0 }, CENTRO)).toEqual(CENTRO);
  });

  it("desfaz o zoom em torno do centro", () => {
    // 100 px à direita do centro na tela, com zoom 2, são 50 px no grafo.
    expect(paraCoordenadaDoGrafo({ x: 300, y: 400 }, 2, { x: 0, y: 0 }, CENTRO)).toEqual({ x: 250, y: 400 });
  });

  it("desfaz deslocamento e zoom na ordem certa", () => {
    // A camada aplica translate e escala a partir do centro; desfazer na ordem
    // errada erra por um fator do zoom.
    expect(paraCoordenadaDoGrafo({ x: 340, y: 420 }, 2, { x: 40, y: 20 }, CENTRO)).toEqual({ x: 250, y: 400 });
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

  it("com alcance mínimo, aceita o dedo mais longe do centro", () => {
    // Um nó de peso 1 tem raio 5,5 px; com a tolerância de 10 o alvo fica com
    // 15,5 px de raio, menor que a ponta de um dedo. O gesto de pegar passa um
    // alcance mínimo para não exigir pontaria.
    expect(noMaisProximoDeCoordenada(posicoes, pesos, { x: 120, y: 100 })).toBeNull();
    expect(noMaisProximoDeCoordenada(posicoes, pesos, { x: 120, y: 100 }, 22)).toBe(0);
  });

  it("o alcance mínimo não vale mais que o raio do nó quando o nó é grande", () => {
    const pesado = [4];
    expect(noMaisProximoDeCoordenada([{ x: 100, y: 100 }], pesado, { x: 128, y: 100 }, 22)).toBe(0);
  });
});
