import { noMaisProximo, posicionarNo, raioDoNo } from "./posicionamento";
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

describe("noMaisProximo", () => {
  it("acha o nó sob o toque", () => {
    const { x, y } = posicionarNo(nos[0], LARGURA, ALTURA);
    expect(noMaisProximo(nos, x, y, LARGURA, ALTURA)).toBe("a");
  });

  it("aceita um toque a até raio + 10 px do centro do nó", () => {
    const { x, y } = posicionarNo(nos[0], LARGURA, ALTURA);
    expect(noMaisProximo(nos, x + raioDoNo(nos[0].peso) + 9, y, LARGURA, ALTURA)).toBe("a");
  });

  it("devolve null quando o toque cai longe de todo mundo", () => {
    const { x, y } = posicionarNo(nos[0], LARGURA, ALTURA);
    expect(noMaisProximo(nos, x + raioDoNo(nos[0].peso) + 40, y, LARGURA, ALTURA)).toBeNull();
  });
});
