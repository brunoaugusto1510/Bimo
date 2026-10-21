import { describe, expect, it } from "vitest";
import { aplicarForma, atualizarCerebro, layoutIgual, type NoDoCerebro } from "./cerebro-do-layout";

function nos(): NoDoCerebro[] {
  return Array.from({ length: 12 }, (_, i) => ({ id: `n${i}`, x: i * 10, y: (i % 3) * 7 }));
}

describe("atualizarCerebro", () => {
  it("sem nós, não há cérebro", () => {
    expect(atualizarCerebro([], null)).toBeNull();
  });

  it("calcula a forma e grava a vaga e o atraso em cada nó", () => {
    const lista = nos();

    const estado = atualizarCerebro(lista, null);

    expect(estado?.forma.alvos.size).toBe(12);
    for (const no of lista) {
      expect(no.cerebroX).toBeTypeOf("number");
      expect(no.cerebroY).toBeTypeOf("number");
      expect(no.atraso).toBeGreaterThanOrEqual(0);
    }
  });

  it("reaproveita a forma quando os nós e as posições são os mesmos, mesmo em objetos novos", () => {
    const primeiro = atualizarCerebro(nos(), null);
    const novos = nos();

    const segundo = atualizarCerebro(novos, primeiro);

    expect(segundo).toBe(primeiro);
    expect(novos[0].cerebroX).toBe(primeiro?.forma.alvos.get("n0")?.x);
  });

  it("recalcula quando chega um nó novo", () => {
    const primeiro = atualizarCerebro(nos(), null);

    const segundo = atualizarCerebro([...nos(), { id: "novo", x: 5, y: 5 }], primeiro);

    expect(segundo).not.toBe(primeiro);
    expect(segundo?.forma.alvos.has("novo")).toBe(true);
  });

  it("recalcula quando um nó mudou de posição", () => {
    const primeiro = atualizarCerebro(nos(), null);
    const movidos = nos();
    movidos[3].x += 1;

    expect(atualizarCerebro(movidos, primeiro)).not.toBe(primeiro);
  });
});

describe("layoutIgual", () => {
  it("é falso sem instantâneo ou com outra quantidade de nós", () => {
    const estado = atualizarCerebro(nos(), null);

    expect(layoutIgual(null, nos())).toBe(false);
    expect(layoutIgual(estado!.instantaneo, nos().slice(1))).toBe(false);
  });

  it("é falso quando a ordem dos ids muda", () => {
    const estado = atualizarCerebro(nos(), null);

    expect(layoutIgual(estado!.instantaneo, nos().reverse())).toBe(false);
  });
});

describe("aplicarForma", () => {
  it("sem forma, limpa a vaga dos nós", () => {
    const lista = nos();
    atualizarCerebro(lista, null);

    aplicarForma(lista, null);

    expect(lista[0].cerebroX).toBeUndefined();
    expect(lista[0].atraso).toBe(0);
  });
});
