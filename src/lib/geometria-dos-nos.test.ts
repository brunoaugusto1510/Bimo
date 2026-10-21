import { describe, expect, it } from "vitest";
import { caixaDosNos, encontrarNoDesenhadoEm, type NoComPosicoes } from "./geometria-dos-nos";

function no(id: string, x: number, y: number, extra: Partial<NoComPosicoes> = {}): NoComPosicoes {
  return { id, x, y, dx: x, dy: y, px: x, py: y, ...extra };
}

describe("caixaDosNos", () => {
  const nos = [no("a", 0, 0, { dx: 10, dy: 20 }), no("b", 100, 50, { dx: 30, dy: 40 })];

  it("mede a posição desenhada", () => {
    expect(caixaDosNos(nos, "desenhada")).toEqual({ minX: 10, maxX: 30, minY: 20, maxY: 40 });
  });

  it("ou a da simulação", () => {
    expect(caixaDosNos(nos, "simulacao")).toEqual({ minX: 0, maxX: 100, minY: 0, maxY: 50 });
  });

  it("considera só os nós aceitos pelo filtro", () => {
    expect(caixaDosNos(nos, "simulacao", (n) => n.id === "b")).toEqual({
      minX: 100,
      maxX: 100,
      minY: 50,
      maxY: 50,
    });
  });

  it("sem nós, não há caixa", () => {
    expect(caixaDosNos([], "desenhada")).toBeNull();
    expect(caixaDosNos(nos, "desenhada", () => false)).toBeNull();
  });
});

describe("encontrarNoDesenhadoEm", () => {
  const camera = { x: 10, y: 20, k: 2 };
  const raio = () => 5;

  it("acerta onde o nó foi desenhado (px, py), não onde a simulação o deixou", () => {
    const desenhado = no("a", 0, 0, { px: 50, py: 50 });

    // px=50, py=50 com zoom 2 e deslocamento (10, 20) cai em (110, 120).
    expect(encontrarNoDesenhadoEm([desenhado], camera, { x: 110, y: 120 }, raio, 0)).toBe(desenhado);
    expect(encontrarNoDesenhadoEm([desenhado], camera, { x: 10, y: 20 }, raio, 0)).toBeNull();
  });

  it("devolve o mais próximo quando as áreas se sobrepõem", () => {
    const longe = no("longe", 0, 0, { px: 50, py: 50 });
    const perto = no("perto", 0, 0, { px: 52, py: 50 });

    expect(encontrarNoDesenhadoEm([longe, perto], camera, { x: 114, y: 120 }, raio, 4)?.id).toBe("perto");
  });

  it("a margem alarga a área de acerto", () => {
    const n = no("a", 0, 0, { px: 50, py: 50 });
    const ponto = { x: 110 + 8, y: 120 };

    expect(encontrarNoDesenhadoEm([n], camera, ponto, raio, 0)).toBeNull();
    expect(encontrarNoDesenhadoEm([n], camera, ponto, raio, 4)).toBe(n);
  });

  it("ignora os nós que o filtro recusa", () => {
    const n = no("a", 0, 0, { px: 50, py: 50 });

    expect(encontrarNoDesenhadoEm([n], camera, { x: 110, y: 120 }, raio, 0, () => false)).toBeNull();
  });
});
