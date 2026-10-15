import { describe, expect, it } from "vitest";
import {
  ZOOM_MAXIMO,
  arrastar,
  calcularCaixa,
  encontrarNoEm,
  enquadrar,
  interpolar,
  limitesDeZoom,
  mundoParaTela,
  quaseIgual,
  raioNaTela,
  telaParaMundo,
  zoomEmTorno,
  type Camera,
} from "./camera-do-grafo";

const CAMERA_PADRAO: Camera = { x: 0, y: 0, k: 1 };

describe("mundoParaTela / telaParaMundo", () => {
  it("aplica escala e deslocamento", () => {
    const camera: Camera = { x: 100, y: 50, k: 2 };

    expect(mundoParaTela(camera, { x: 10, y: 20 })).toEqual({ x: 120, y: 90 });
  });

  it("é a inversa de mundoParaTela", () => {
    const camera: Camera = { x: -37, y: 12, k: 0.25 };
    const ponto = { x: 410, y: -88 };

    const volta = telaParaMundo(camera, mundoParaTela(camera, ponto));

    expect(volta.x).toBeCloseTo(ponto.x);
    expect(volta.y).toBeCloseTo(ponto.y);
  });
});

describe("arrastar", () => {
  it("devolve uma câmera nova, sem mutar a original", () => {
    const original: Camera = { x: 5, y: 5, k: 1 };

    const movida = arrastar(original, 10, -3);

    expect(movida).toEqual({ x: 15, y: 2, k: 1 });
    expect(original).toEqual({ x: 5, y: 5, k: 1 });
  });
});

describe("zoomEmTorno", () => {
  const limites = { min: 0.1, max: 4 };

  it("mantém fixo o ponto do mundo que está sob o cursor", () => {
    const camera: Camera = { x: 30, y: 40, k: 1 };
    const cursor = { x: 200, y: 120 };
    const mundoAntes = telaParaMundo(camera, cursor);

    const depois = zoomEmTorno(camera, cursor, 2, limites);

    const mundoDepois = telaParaMundo(depois, cursor);
    expect(depois.k).toBe(2);
    expect(mundoDepois.x).toBeCloseTo(mundoAntes.x);
    expect(mundoDepois.y).toBeCloseTo(mundoAntes.y);
  });

  it("respeita o zoom máximo e o mínimo", () => {
    expect(zoomEmTorno({ x: 0, y: 0, k: 3 }, { x: 0, y: 0 }, 10, limites).k).toBe(4);
    expect(zoomEmTorno({ x: 0, y: 0, k: 0.2 }, { x: 0, y: 0 }, 0.01, limites).k).toBe(0.1);
  });

  it("não muda nada quando já está no limite e o fator empurra para fora", () => {
    const noLimite: Camera = { x: 7, y: 9, k: 4 };

    expect(zoomEmTorno(noLimite, { x: 50, y: 50 }, 2, limites)).toEqual(noLimite);
  });
});

describe("limitesDeZoom", () => {
  it("deixa afastar até metade do enquadramento e aproximar até o máximo", () => {
    expect(limitesDeZoom(0.06)).toEqual({ min: 0.03, max: ZOOM_MAXIMO });
  });

  it("não deixa o máximo ficar abaixo do enquadramento", () => {
    expect(limitesDeZoom(10).max).toBe(10);
  });
});

describe("calcularCaixa", () => {
  it("devolve null sem pontos", () => {
    expect(calcularCaixa([])).toBeNull();
  });

  it("envolve todos os pontos", () => {
    const caixa = calcularCaixa([
      { x: -10, y: 5 },
      { x: 30, y: -20 },
      { x: 0, y: 40 },
    ]);

    expect(caixa).toEqual({ minX: -10, maxX: 30, minY: -20, maxY: 40 });
  });
});

describe("enquadrar", () => {
  const caixa = { minX: -500, maxX: 500, minY: -250, maxY: 250 };

  it("centraliza o conteúdo na tela", () => {
    const camera = enquadrar(caixa, 800, 600, { margem: 0, ocupacao: 1, zoomMaximo: 10 });

    const centro = mundoParaTela(camera, { x: 0, y: 0 });
    expect(centro.x).toBeCloseTo(400);
    expect(centro.y).toBeCloseTo(300);
  });

  it("escolhe a escala do eixo mais apertado", () => {
    // 1000 de largura em 800px de tela => k = 0.8; a altura (500 em 600) cabe de sobra.
    const camera = enquadrar(caixa, 800, 600, { margem: 0, ocupacao: 1, zoomMaximo: 10 });

    expect(camera.k).toBeCloseTo(0.8);
  });

  it("deixa respiro com a ocupação menor que 1", () => {
    const camera = enquadrar(caixa, 800, 600, { margem: 0, ocupacao: 0.5, zoomMaximo: 10 });

    expect(camera.k).toBeCloseTo(0.4);
  });

  it("nunca aproxima além do zoomMaximo — um grafo pequeno não é ampliado", () => {
    const pequena = { minX: 0, maxX: 10, minY: 0, maxY: 10 };

    expect(enquadrar(pequena, 800, 600, { margem: 0, ocupacao: 1, zoomMaximo: 1 }).k).toBe(1);
  });

  it("não quebra com uma caixa de um ponto só", () => {
    const ponto = { minX: 5, maxX: 5, minY: 5, maxY: 5 };

    const camera = enquadrar(ponto, 800, 600, { margem: 0, ocupacao: 1, zoomMaximo: 2 });

    expect(Number.isFinite(camera.k)).toBe(true);
    expect(Number.isFinite(camera.x)).toBe(true);
  });
});

describe("interpolar / quaseIgual", () => {
  it("t=0 é a origem, t=1 é o destino, e o meio é a média", () => {
    const a: Camera = { x: 0, y: 0, k: 1 };
    const b: Camera = { x: 100, y: 50, k: 3 };

    expect(interpolar(a, b, 0)).toEqual(a);
    expect(interpolar(a, b, 1)).toEqual(b);
    expect(interpolar(a, b, 0.5)).toEqual({ x: 50, y: 25, k: 2 });
  });

  it("reconhece câmeras praticamente iguais", () => {
    expect(quaseIgual(CAMERA_PADRAO, { x: 0.1, y: -0.1, k: 1.0001 })).toBe(true);
    expect(quaseIgual(CAMERA_PADRAO, { x: 5, y: 0, k: 1 })).toBe(false);
    expect(quaseIgual(CAMERA_PADRAO, { x: 0, y: 0, k: 1.5 })).toBe(false);
  });
});

describe("raioNaTela", () => {
  it("segue a escala quando perto", () => {
    expect(raioNaTela(10, 2)).toBe(20);
  });

  it("não some quando muito afastado — hubs continuam visíveis", () => {
    // 10 * 0.06 = 0.6, mas o piso proporcional (10 * 0.18 = 1.8) segura.
    expect(raioNaTela(10, 0.06)).toBeCloseTo(1.8);
  });

  it("tem um mínimo absoluto, mesmo para nós minúsculos", () => {
    expect(raioNaTela(1, 0.01)).toBe(1.2);
  });
});

describe("encontrarNoEm", () => {
  const nos = [
    { id: "a", x: 0, y: 0 },
    { id: "b", x: 6, y: 0 },
    { id: "longe", x: 500, y: 500 },
  ];
  const raio = () => 5;

  it("acha o nó sob o ponto", () => {
    expect(encontrarNoEm(nos, CAMERA_PADRAO, { x: 500, y: 500 }, raio, 0)?.id).toBe("longe");
  });

  it("devolve null quando não há nada perto", () => {
    expect(encontrarNoEm(nos, CAMERA_PADRAO, { x: 250, y: 250 }, raio, 4)).toBeNull();
  });

  it("entre nós sobrepostos, escolhe o mais próximo do clique", () => {
    // x=4 está dentro dos dois (raio 5), mas é mais perto de b (6) do que de a (0).
    expect(encontrarNoEm(nos, CAMERA_PADRAO, { x: 4, y: 0 }, raio, 0)?.id).toBe("b");
  });

  it("a margem aumenta a área de toque", () => {
    expect(encontrarNoEm(nos, CAMERA_PADRAO, { x: 0, y: 8 }, raio, 0)).toBeNull();
    expect(encontrarNoEm(nos, CAMERA_PADRAO, { x: 0, y: 8 }, raio, 4)?.id).toBe("a");
  });

  it("considera a câmera ao converter a posição do nó", () => {
    const camera: Camera = { x: 100, y: 100, k: 2 };

    // O nó "b" (6, 0) aparece em (112, 100) com essa câmera.
    expect(encontrarNoEm(nos, camera, { x: 112, y: 100 }, raio, 0)?.id).toBe("b");
  });
});
