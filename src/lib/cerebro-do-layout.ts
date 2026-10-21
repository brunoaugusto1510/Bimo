/**
 * O cérebro de um layout: calcula a forma (cara, ~100 ms com centenas de nós) só quando
 * os nós ou as posições mudaram de verdade, e grava em cada nó a vaga e o atraso dele.
 */

import { montarFormaDoCerebro, type FormaDoCerebro } from "./forma-do-cerebro";

export type NoDoCerebro = {
  id: string;
  x: number;
  y: number;
  cerebroX?: number;
  cerebroY?: number;
  atraso?: number;
};

/** Os ids e as posições do globo para os quais a forma foi calculada. */
export type InstantaneoDoLayout = { ids: readonly string[]; xs: Float64Array; ys: Float64Array };

export type EstadoDoCerebro = { forma: FormaDoCerebro; instantaneo: InstantaneoDoLayout };

function tirarInstantaneo(nos: readonly NoDoCerebro[]): InstantaneoDoLayout {
  const xs = new Float64Array(nos.length);
  const ys = new Float64Array(nos.length);
  nos.forEach((no, i) => {
    xs[i] = no.x;
    ys[i] = no.y;
  });
  return { ids: nos.map((no) => no.id), xs, ys };
}

/** Os mesmos nós, na mesma ordem, exatamente nas mesmas posições. */
export function layoutIgual(instantaneo: InstantaneoDoLayout | null, nos: readonly NoDoCerebro[]): boolean {
  if (!instantaneo || instantaneo.ids.length !== nos.length) return false;
  return nos.every(
    (no, i) => no.id === instantaneo.ids[i] && no.x === instantaneo.xs[i] && no.y === instantaneo.ys[i],
  );
}

/** Grava em cada nó a vaga no cérebro e o atraso da varredura; quem não tem vaga volta a ficar sem. */
export function aplicarForma(nos: NoDoCerebro[], forma: FormaDoCerebro | null): void {
  for (const no of nos) {
    const vaga = forma?.alvos.get(no.id);
    no.cerebroX = vaga?.x;
    no.cerebroY = vaga?.y;
    no.atraso = forma?.atrasos.get(no.id) ?? 0;
  }
}

/**
 * Devolve o cérebro do layout atual. Se nada mudou desde o `atual`, reaproveita a forma;
 * se mudou, recalcula. Sempre grava nos nós, que podem ser objetos novos a cada layout.
 */
export function atualizarCerebro(
  nos: NoDoCerebro[],
  atual: EstadoDoCerebro | null,
): EstadoDoCerebro | null {
  if (nos.length === 0) return null;
  const estado =
    atual && layoutIgual(atual.instantaneo, nos)
      ? atual
      : { forma: montarFormaDoCerebro(nos), instantaneo: tirarInstantaneo(nos) };
  aplicarForma(nos, estado.forma);
  return estado;
}
