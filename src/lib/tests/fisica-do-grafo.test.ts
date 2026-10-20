import { describe, expect, it } from "vitest";
import {
  CONFIGURACAO_PADRAO,
  calcularGraus,
  converterParaForcas,
  raioDoNo,
} from "../fisica-do-grafo";

describe("converterParaForcas", () => {
  it("com a configuração padrão, chega às forças padrão do Obsidian", () => {
    const forcas = converterParaForcas(CONFIGURACAO_PADRAO);

    expect(forcas.centralizacao).toBeCloseTo(0.1, 6);
    expect(forcas.link).toBeCloseTo(1, 6);
    expect(forcas.repulsao).toBe(1000);
    expect(forcas.distanciaDoLink).toBe(250);
  });

  it("reconhece a posição de slider gravada no graph.json de um vault com valores padrão", () => {
    // Valor real do `.obsidian/graph.json` de um vault que nunca mexeu no slider.
    const forcas = converterParaForcas({ ...CONFIGURACAO_PADRAO, centerStrength: 0.518713248970312 });
    expect(forcas.centralizacao).toBeCloseTo(0.1, 6);
  });

  it("eleva a repulsão ao cubo, com piso de 1", () => {
    expect(converterParaForcas({ ...CONFIGURACAO_PADRAO, repelStrength: 2 }).repulsao).toBe(8);
    expect(converterParaForcas({ ...CONFIGURACAO_PADRAO, repelStrength: 0.5 }).repulsao).toBe(1);
    expect(converterParaForcas({ ...CONFIGURACAO_PADRAO, repelStrength: 0 }).repulsao).toBe(1);
  });

  it("leva os extremos do slider de 0 a 1 para forças de 0 a 1", () => {
    const noZero = converterParaForcas({ ...CONFIGURACAO_PADRAO, centerStrength: 0, linkStrength: 0 });
    expect(noZero.centralizacao).toBeCloseTo(0, 6);
    expect(noZero.link).toBeCloseTo(0, 6);
  });
});

describe("raioDoNo", () => {
  it("cresce com a raiz do grau, entre 8 e 30", () => {
    expect(raioDoNo(0, 1)).toBe(8);
    expect(raioDoNo(15, 1)).toBe(12);
    expect(raioDoNo(1000, 1)).toBe(30);
  });

  it("aplica o multiplicador de tamanho depois do limite", () => {
    expect(raioDoNo(1000, 2)).toBe(60);
    expect(raioDoNo(0, 0.5)).toBe(4);
  });
});

describe("calcularGraus", () => {
  it("conta quantas arestas tocam cada nó", () => {
    const graus = calcularGraus([
      { de: "a", para: "b" },
      { de: "a", para: "c" },
    ]);

    expect(graus.get("a")).toBe(2);
    expect(graus.get("b")).toBe(1);
    expect(graus.get("c")).toBe(1);
    expect(graus.get("d")).toBeUndefined();
  });
});
