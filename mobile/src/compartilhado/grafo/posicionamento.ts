import type { NoDoGrafo } from "@/dados/tipos";
import { raioDoCampo } from "./fisica";

const EXPANSAO = 1.05;
const RAIO_POR_PESO = 5.5;
const TOLERANCIA_DE_TOQUE = 10;

// Mora aqui, e não em useSimulacao.ts, porque `useSimulacao` -> `simulacao` ->
// `posicionamento` já é a cadeia de import: declarar do outro lado fecharia
// um ciclo.
export type Posicao = { x: number; y: number };

export function raioDoNo(peso: number): number {
  return peso * RAIO_POR_PESO;
}

export function posicionarNo(no: NoDoGrafo, largura: number, altura: number): { x: number; y: number } {
  const raio = raioDoCampo(largura, altura) * EXPANSAO;
  return {
    x: largura / 2 + (no.x - 0.5) * 2 * raio,
    y: altura / 2 + (no.y - 0.5) * 2 * raio,
  };
}

// A camada do grafo aplica translate e depois scale, então desfazer é subtrair
// o deslocamento e só então dividir pelo zoom. Na ordem trocada o erro é de um
// fator do zoom — o toque acerta um vizinho, ou nenhum.
export function paraCoordenadaDoGrafo(toque: Posicao, zoom: number, deslocamento: Posicao): Posicao {
  "worklet";
  return { x: (toque.x - deslocamento.x) / zoom, y: (toque.y - deslocamento.y) / zoom };
}

// Devolve o índice, não o id: quem chama já tem os arrays paralelos da
// simulação em mãos e o índice é o que o shared value de posições usa.
export function noMaisProximoDeCoordenada(posicoes: Posicao[], pesos: number[], ponto: Posicao): number | null {
  "worklet";
  let escolhido: number | null = null;
  let menorDistancia = Number.POSITIVE_INFINITY;

  for (let i = 0; i < posicoes.length; i += 1) {
    const distancia = Math.hypot(posicoes[i].x - ponto.x, posicoes[i].y - ponto.y);
    if (distancia <= raioDoNo(pesos[i]) + TOLERANCIA_DE_TOQUE && distancia < menorDistancia) {
      menorDistancia = distancia;
      escolhido = i;
    }
  }

  return escolhido;
}
