import type { NoDoGrafo } from "@/dados/tipos";
import { raioDoCampo } from "./fisica";

const EXPANSAO = 1.05;
const RAIO_POR_PESO = 5.5;
const TOLERANCIA_DE_TOQUE = 10;

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

export function noMaisProximo(
  nos: NoDoGrafo[],
  toqueX: number,
  toqueY: number,
  largura: number,
  altura: number,
): string | null {
  let escolhido: string | null = null;
  let menorDistancia = Number.POSITIVE_INFINITY;

  for (const no of nos) {
    const { x, y } = posicionarNo(no, largura, altura);
    const distancia = Math.hypot(x - toqueX, y - toqueY);
    if (distancia <= raioDoNo(no.peso) + TOLERANCIA_DE_TOQUE && distancia < menorDistancia) {
      menorDistancia = distancia;
      escolhido = no.id;
    }
  }

  return escolhido;
}
