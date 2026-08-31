import type { NoDoGrafo } from "@/dados/tipos";
import { raioDoCampo } from "./fisica";

const EXPANSAO = 1.05;
const RAIO_POR_PESO = 5.5;
const TOLERANCIA_DE_TOQUE = 10;

// Mora aqui, e não em useSimulacao.ts, porque `useSimulacao` -> `simulacao` ->
// `posicionamento` já é a cadeia de import: declarar do outro lado fecharia
// um ciclo.
export type Posicao = { x: number; y: number };

// Leva "worklet" porque roda na UI: `noMaisProximoDeCoordenada` a chama no
// hit-test do gesto, e os componentes animados a usam para posicionar rótulo e
// alvo. Sem a diretiva vira uma chamada de função remota e derruba a tela com
// "Tried to synchronously call a Remote Function".
export function raioDoNo(peso: number): number {
  "worklet";
  return peso * RAIO_POR_PESO;
}

export function posicionarNo(no: NoDoGrafo, largura: number, altura: number): { x: number; y: number } {
  const raio = raioDoCampo(largura, altura) * EXPANSAO;
  return {
    x: largura / 2 + (no.x - 0.5) * 2 * raio,
    y: altura / 2 + (no.y - 0.5) * 2 * raio,
  };
}

// A camada do grafo aplica translate e escala **a partir do centro** — é o
// `transformOrigin` padrão do React Native, e não o canto superior esquerdo.
// Desfazer é: tirar o deslocamento, medir a distância até o centro e dividir
// essa distância pelo zoom. Ignorar o centro dá um erro de
// `centro × (1 - 1/zoom)`: com zoom 2 numa tela de 800 px de altura, 200 px
// fora do alvo — o toque longo simplesmente não acha o nó depois de um zoom.
export function paraCoordenadaDoGrafo(
  toque: Posicao,
  zoom: number,
  deslocamento: Posicao,
  centro: Posicao,
): Posicao {
  "worklet";
  return {
    x: centro.x + (toque.x - deslocamento.x - centro.x) / zoom,
    y: centro.y + (toque.y - deslocamento.y - centro.y) / zoom,
  };
}

// Devolve o índice, não o id: quem chama já tem os arrays paralelos da
// simulação em mãos e o índice é o que o shared value de posições usa.
//
// `alcanceMinimo` existe porque os nós são desenhados pequenos — peso 1 dá
// 5,5 px de raio, e com a tolerância o alvo fica menor que a ponta de um dedo.
// Quem precisa de pontaria confortável (o gesto de pegar o nó) passa um piso;
// quem não passa fica com o alvo do desenho.
export function noMaisProximoDeCoordenada(
  posicoes: Posicao[],
  pesos: number[],
  ponto: Posicao,
  alcanceMinimo = 0,
): number | null {
  "worklet";
  let escolhido: number | null = null;
  let menorDistancia = Number.POSITIVE_INFINITY;

  for (let i = 0; i < posicoes.length; i += 1) {
    const distancia = Math.hypot(posicoes[i].x - ponto.x, posicoes[i].y - ponto.y);
    const alcance = Math.max(raioDoNo(pesos[i]) + TOLERANCIA_DE_TOQUE, alcanceMinimo);
    if (distancia <= alcance && distancia < menorDistancia) {
      menorDistancia = distancia;
      escolhido = i;
    }
  }

  return escolhido;
}
