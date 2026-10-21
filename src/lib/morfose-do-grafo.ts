/**
 * Conta da passagem globo ↔ cérebro: progresso geral, posição-alvo de cada nó e
 * o deslize da posição desenhada. Puro e sem alocar por nó — roda a cada quadro
 * sobre centenas de nós, então o movimento altera o próprio nó.
 */

import type { Ponto } from "./camera-do-grafo";
import { progressoDoNo } from "./forma-do-cerebro";

export const DURACAO_DA_MORFOSE_MS = 1200;

/** Fração do caminho que a posição desenhada anda por quadro (a 60 quadros por segundo). */
const SUAVIZACAO_POR_QUADRO = 0.2;
const MS_POR_QUADRO = 1000 / 60;
/** Mais perto que isto do alvo (em unidades do mundo), encosta nele. */
const DISTANCIA_DE_ENCOSTO = 0.01;

/** Nós muito ligados engordam um pouco no cérebro; passou deste grau, para de crescer. */
const GRAU_QUE_SATURA = 6;
const CRESCIMENTO_NO_CEREBRO = 0.3;

function intervaloValido(dtMs: number): number {
  return Number.isFinite(dtMs) && dtMs > 0 ? dtMs : 0;
}

/** Anda o progresso geral rumo ao alvo (0 = globo, 1 = cérebro) pelo tempo decorrido. */
export function avancarProgresso(
  atual: number,
  alvo: number,
  dtMs: number,
  reduzido = false,
): number {
  if (reduzido) return alvo;
  const passo = intervaloValido(dtMs) / DURACAO_DA_MORFOSE_MS;
  if (atual < alvo) return Math.min(alvo, atual + passo);
  return Math.max(alvo, atual - passo);
}

/** Para onde o nó quer ir: entre o globo e a vaga no cérebro, no progresso do próprio nó. */
export function posicaoAlvo(globo: Ponto, cerebro: Ponto | undefined, progressoDoNo: number): Ponto {
  if (!cerebro) return { x: globo.x, y: globo.y };
  return {
    x: globo.x + (cerebro.x - globo.x) * progressoDoNo,
    y: globo.y + (cerebro.y - globo.y) * progressoDoNo,
  };
}

/** Quanto do caminho até o alvo a posição desenhada anda num quadro de `dtMs`, igual em qualquer taxa de quadros. */
export function fatorDeSuavizacao(dtMs: number): number {
  const quadros = intervaloValido(dtMs) / MS_POR_QUADRO;
  return 1 - (1 - SUAVIZACAO_POR_QUADRO) ** quadros;
}

/** O que o movimento precisa de cada nó: a posição da simulação (globo), a desenhada e a vaga no cérebro. */
export type NoMorfavel = {
  x: number;
  y: number;
  dx: number;
  dy: number;
  /** 0..1, escrito aqui: quanto este nó já virou cérebro. */
  progresso: number;
  cerebroX?: number;
  cerebroY?: number;
  /** Atraso da varredura, de `forma-do-cerebro`. */
  atraso?: number;
};

export type ParametrosDoMovimento = {
  progressoGeral: number;
  interativo: boolean;
  /** Resultado de `fatorDeSuavizacao` — calculado uma vez por quadro. */
  fator: number;
  reduzido: boolean;
};

function encostar(atual: number, alvo: number, fator: number): number {
  return atual + (alvo - atual) * fator;
}

/**
 * Leva a posição desenhada do nó (`dx`, `dy`) para onde ela deve estar e atualiza o
 * `progresso` dele. Interativo e parado no globo: a posição exata da simulação
 * (cliques e arrastos dependem disso). Fora isso, desliza até o alvo — ou vai direto,
 * com movimento reduzido. Devolve se a posição desenhada mudou.
 */
export function moverNoDesenhado(
  no: NoMorfavel,
  { progressoGeral, interativo, fator, reduzido }: ParametrosDoMovimento,
): boolean {
  const temVaga = no.cerebroX !== undefined && no.cerebroY !== undefined;
  const doNo = temVaga ? progressoDoNo(progressoGeral, no.atraso ?? 0) : 0;
  no.progresso = doNo;

  const alvoX = temVaga ? no.x + ((no.cerebroX as number) - no.x) * doNo : no.x;
  const alvoY = temVaga ? no.y + ((no.cerebroY as number) - no.y) * doNo : no.y;

  let novoX = alvoX;
  let novoY = alvoY;
  if (!(interativo && progressoGeral === 0) && !reduzido) {
    novoX = encostar(no.dx, alvoX, fator);
    novoY = encostar(no.dy, alvoY, fator);
    if (Math.hypot(alvoX - novoX, alvoY - novoY) < DISTANCIA_DE_ENCOSTO) {
      novoX = alvoX;
      novoY = alvoY;
    }
  }

  const mudou = novoX !== no.dx || novoY !== no.dy;
  no.dx = novoX;
  no.dy = novoY;
  return mudou;
}

/** Multiplicador do raio de um nó no cérebro: cresce com o grau, na proporção de quanto já virou cérebro. */
export function fatorDeRaioNoCerebro(grau: number, progressoDoNo: number): number {
  const grauUtil = Math.min(Math.max(grau, 0), GRAU_QUE_SATURA);
  return 1 + CRESCIMENTO_NO_CEREBRO * progressoDoNo * (grauUtil / GRAU_QUE_SATURA);
}
