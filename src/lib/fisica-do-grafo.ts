/**
 * Os parâmetros do grafo no formato do `.obsidian/graph.json` e a conversão
 * deles para as forças do d3-force — o que faz o grafo do Bimo se comportar
 * como o "graph view" do Obsidian.
 *
 * O `graph.json` não guarda forças: guarda a *posição de cada slider* da tela
 * de configuração do Obsidian. A tradução slider -> força abaixo reproduz o
 * comportamento observado no Obsidian 1.13 (curvas, limites e padrões);
 * nenhum código dele foi copiado.
 *
 * Não importa nada de servidor: roda tanto em `grafo.ts` (que lê o
 * `graph.json` do repositório) quanto no `GrafoDeFundo` (que simula).
 */

/** Só os campos do `graph.json` que o Bimo usa. Os nomes seguem o arquivo do Obsidian. */
export type ConfiguracaoDoGrafo = {
  /** Slider de 0 a 1 — atração de cada nó para o centro. */
  centerStrength: number;
  /** Slider de 0 a 20 — repulsão entre nós. */
  repelStrength: number;
  /** Slider de 0 a 1 — rigidez da mola de cada link. */
  linkStrength: number;
  /** Comprimento de repouso de cada link, em unidades da simulação. */
  linkDistance: number;
  /** Multiplica o raio de todos os nós. */
  nodeSizeMultiplier: number;
  /** Tags (`#assim`) viram nós ligados às notas que as usam. */
  showTags: boolean;
  /** Esconde os links para notas que ainda não existem. */
  hideUnresolved: boolean;
  /** Mantém no grafo as notas sem nenhuma ligação. */
  showOrphans: boolean;
};

/** As forças efetivas que a simulação recebe. */
export type ForcasDoGrafo = {
  centralizacao: number;
  link: number;
  /** Magnitude — a simulação aplica com sinal negativo, que é o que empurra. */
  repulsao: number;
  distanciaDoLink: number;
};

/**
 * Base da curva dos sliders de centro e de link. A curva é exponencial: o
 * slider anda devagar perto de zero, onde pequenas mudanças de força já
 * mudam muito o layout.
 */
const BASE_DA_CURVA = 0.01;

/** Posição de slider (0 a 1) -> força (0 a 1). */
function sliderParaForca(posicao: number): number {
  return (BASE_DA_CURVA ** (1 - posicao) - BASE_DA_CURVA) / (1 - BASE_DA_CURVA);
}

/** Força (0 a 1) -> posição de slider (0 a 1). Inverso de `sliderParaForca`. */
function forcaParaSlider(forca: number): number {
  return 1 - Math.log(forca * (1 - BASE_DA_CURVA) + BASE_DA_CURVA) / Math.log(BASE_DA_CURVA);
}

/** Os padrões do Obsidian — valem para todo campo ausente ou inválido no `graph.json`. */
export const CONFIGURACAO_PADRAO: ConfiguracaoDoGrafo = {
  centerStrength: forcaParaSlider(0.1),
  repelStrength: 10,
  linkStrength: forcaParaSlider(1),
  linkDistance: 250,
  nodeSizeMultiplier: 1,
  showTags: false,
  hideUnresolved: false,
  showOrphans: true,
};

/** Raio de colisão, igual para todo nó: independe do tamanho desenhado. */
export const RAIO_DE_COLISAO = 60;
export const FORCA_DE_COLISAO = 0.5;
/** Abaixo disso a repulsão para de crescer — evita empurrões explosivos entre nós sobrepostos. */
export const DISTANCIA_MINIMA_DE_REPULSAO = 30;
/** Precisão da aproximação de Barnes-Hut: maior = mais rápido e menos exato. */
export const THETA_DA_REPULSAO = 0.9;

const RAIO_MINIMO_DO_NO = 8;
export const RAIO_MAXIMO_DO_NO = 30;

export function converterParaForcas(configuracao: ConfiguracaoDoGrafo): ForcasDoGrafo {
  return {
    centralizacao: sliderParaForca(configuracao.centerStrength),
    link: sliderParaForca(configuracao.linkStrength),
    // Ao cubo: o slider vai até 20, a força até 8000. O piso de 1 mantém
    // alguma repulsão mesmo com o slider no zero.
    repulsao: Math.max(configuracao.repelStrength ** 3, 1),
    distanciaDoLink: configuracao.linkDistance,
  };
}

/** Raio desenhado de um nó: cresce com a raiz do grau (área ~ grau), entre 8 e 30. */
export function raioDoNo(grau: number, multiplicador: number): number {
  const raio = Math.min(Math.max(3 * Math.sqrt(grau + 1), RAIO_MINIMO_DO_NO), RAIO_MAXIMO_DO_NO);
  return raio * multiplicador;
}

/** Quantas arestas tocam cada nó. Nó sem aresta fica de fora do mapa. */
export function calcularGraus(arestas: { de: string; para: string }[]): Map<string, number> {
  const graus = new Map<string, number>();
  for (const { de, para } of arestas) {
    graus.set(de, (graus.get(de) ?? 0) + 1);
    graus.set(para, (graus.get(para) ?? 0) + 1);
  }
  return graus;
}
