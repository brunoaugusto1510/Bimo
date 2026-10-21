/**
 * Contas sobre a lista de nós que rodam a cada quadro ou a cada movimento do ponteiro:
 * escrevem em objetos já existentes ou só percorrem a lista, sem montar listas auxiliares.
 */

import type { Caixa, Camera, Ponto } from "./camera-do-grafo";

/** Posição na simulação (`x`, `y`), a desenhada (`dx`, `dy`) e a do último quadro, com a respiração (`px`, `py`). */
export type NoComPosicoes = { id: string; x: number; y: number; dx: number; dy: number; px: number; py: number };

/** A menor caixa que contém os nós — na posição desenhada, ou na da simulação (o globo). */
export function caixaDosNos(
  nos: readonly NoComPosicoes[],
  posicao: "desenhada" | "simulacao",
  incluir?: (no: NoComPosicoes) => boolean,
): Caixa | null {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let achou = false;

  for (const no of nos) {
    if (incluir && !incluir(no)) continue;
    const x = posicao === "desenhada" ? no.dx : no.x;
    const y = posicao === "desenhada" ? no.dy : no.y;
    achou = true;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return achou ? { minX, maxX, minY, maxY } : null;
}

/**
 * O nó sob o ponto de tela, medido onde ele foi desenhado no último quadro (`px`, `py`,
 * com respiração). Devolve o mais próximo, não o primeiro: afastado, as áreas de toque se sobrepõem.
 */
export function encontrarNoDesenhadoEm<T extends NoComPosicoes>(
  nos: readonly T[],
  camera: Camera,
  ponto: Ponto,
  raioNaTelaDe: (no: T) => number,
  margem: number,
  incluir?: (no: T) => boolean,
): T | null {
  let melhor: T | null = null;
  let menorDistancia2 = Infinity;

  for (const no of nos) {
    if (incluir && !incluir(no)) continue;
    const dx = no.px * camera.k + camera.x - ponto.x;
    const dy = no.py * camera.k + camera.y - ponto.y;
    const distancia2 = dx * dx + dy * dy;
    const alcance = raioNaTelaDe(no) + margem;
    if (distancia2 <= alcance ** 2 && distancia2 < menorDistancia2) {
      melhor = no;
      menorDistancia2 = distancia2;
    }
  }
  return melhor;
}
