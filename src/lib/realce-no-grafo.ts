import type { QuadroDoRastro } from "./rastro-do-agente";
import type { IdDeNota } from "./types";

/** Por quanto tempo uma nota pedida pelo chat ("Fontes") fica acesa no cérebro. */
export const DURACAO_DO_REALCE_MS = 1800;

/** O fim do realce apaga aos poucos, como o resto do rastro, em vez de sumir num quadro. */
export const SAIDA_DO_REALCE_MS = 300;

/** Uma nota que a pessoa pediu para achar no cérebro; `em` no relógio de `performance.now()`. */
export type RealceNoGrafo = { id: IdDeNota; em: number };

/**
 * Acende a nota pedida como se o Bimo a estivesse lendo (brilho pulsante, anel e rótulo),
 * por cima do que o rastro já mostra. Fora da janela devolve o mesmo quadro, sem copiar.
 */
export function aplicarRealce(quadro: QuadroDoRastro, realce: RealceNoGrafo | null, agora: number): QuadroDoRastro {
  if (!realce || agora < realce.em || agora - realce.em >= DURACAO_DO_REALCE_MS) return quadro;
  const intensidade = Math.min(1, (DURACAO_DO_REALCE_MS - (agora - realce.em)) / SAIDA_DO_REALCE_MS);
  const notas = new Map(quadro.notas);
  notas.set(realce.id, { estado: "lendo", intensidade, desde: realce.em });
  return { ...quadro, notas };
}
