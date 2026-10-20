/**
 * Monta a simulação de física do grafo (d3-force) a partir dos nós e das
 * arestas. Extraído do `GrafoDeFundo` para ficar testável sem canvas.
 *
 * A física segue a do graph view do Obsidian (ver `fisica-do-grafo.ts`): cada
 * nó é puxado para a origem por forceX/Y — não `forceCenter`, que só desloca
 * o conjunto sem atrair nó nenhum —, os links são molas cuja força cai com o
 * grau das pontas, todos se repelem e ninguém se sobrepõe. As forças vêm do
 * configuração do grafo (`CONFIGURACAO_PADRAO`).
 */

import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type Simulation,
} from "d3-force";
import {
  DISTANCIA_MINIMA_DE_REPULSAO,
  FORCA_DE_COLISAO,
  RAIO_DE_COLISAO,
  THETA_DA_REPULSAO,
  converterParaForcas,
  type ConfiguracaoDoGrafo,
} from "./fisica-do-grafo";
import type { ArestaDoGrafo, NoDoGrafo } from "./grafo-de-notas";

/**
 * Um nó com posição. `fx`/`fy` fixam o nó num ponto (é assim que o arrastar
 * funciona: enquanto estão definidos, a simulação não o move, mas os vizinhos
 * continuam sendo puxados por ele).
 */
export type NoSimulado = NoDoGrafo & {
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx?: number | null;
  fy?: number | null;
};

export type LinkSimulado = { source: NoSimulado; target: NoSimulado };

export type SimulacaoDoGrafo = {
  nos: NoSimulado[];
  links: LinkSimulado[];
  /** Já acomodada e parada: quem quiser animar chama `tick()` no próprio loop. */
  simulacao: Simulation<NoSimulado, undefined>;
};

/**
 * Passos de física rodados de uma vez, antes do primeiro desenho: o layout já
 * nasce pronto. Depender de acumular quadros desenhava com o zoom errado onde o
 * `requestAnimationFrame` vem estrangulado (aba em segundo plano, headless).
 * Com o decaimento padrão do d3 a simulação esfria em ~300 passos.
 */
export const PASSOS_DE_ACOMODACAO = 400;

/**
 * Quem está ligado a quem, nos dois sentidos: o grafo é desenhado sem seta, e
 * selecionar uma nota destaca as ligações que saem *e* as que chegam nela.
 */
export function montarVizinhos(
  arestas: readonly ArestaDoGrafo[],
): Map<string, ReadonlySet<string>> {
  const vizinhos = new Map<string, Set<string>>();
  const registrar = (de: string, para: string) => {
    const conjunto = vizinhos.get(de) ?? new Set<string>();
    conjunto.add(para);
    vizinhos.set(de, conjunto);
  };

  for (const { de, para } of arestas) {
    if (de === para) continue;
    registrar(de, para);
    registrar(para, de);
  }
  return vizinhos;
}

type Parametros = {
  nos: readonly NoDoGrafo[];
  arestas: readonly ArestaDoGrafo[];
  configuracao: ConfiguracaoDoGrafo;
  /** Nº de ligações de cada nó (`calcularGraus`) — enfraquece as molas dos hubs. */
  graus: ReadonlyMap<string, number>;
  /** Injetável para os testes não dependerem de `Math.random`. */
  aleatorio?: () => number;
  passos?: number;
  /** Refresh de dados preserva o layout dos ids que continuam no grafo. */
  posicoes?: ReadonlyMap<string, Pick<NoSimulado, "x" | "y" | "vx" | "vy">>;
};

export function criarSimulacaoDoGrafo({
  nos,
  arestas,
  configuracao,
  graus,
  aleatorio = Math.random,
  passos = PASSOS_DE_ACOMODACAO,
  posicoes,
}: Parametros): SimulacaoDoGrafo {
  const forcas = converterParaForcas(configuracao);
  const grau = (id: string) => graus.get(id) ?? 0;

  // Posição inicial num disco em volta da origem, com área proporcional ao
  // número de nós — começar tudo amontoado faz a repulsão explodir o layout.
  const raioInicial = (forcas.distanciaDoLink * Math.sqrt(nos.length)) / 2;
  const nosSimulados: NoSimulado[] = nos.map((no) => {
    const angulo = aleatorio() * Math.PI * 2;
    const distancia = Math.sqrt(aleatorio()) * raioInicial;
    const anterior = posicoes?.get(no.id);
    return {
      ...no,
      x: anterior?.x ?? Math.cos(angulo) * distancia,
      y: anterior?.y ?? Math.sin(angulo) * distancia,
      vx: anterior?.vx ?? 0,
      vy: anterior?.vy ?? 0,
    };
  });
  const porId = new Map(nosSimulados.map((n) => [n.id, n]));

  const links: LinkSimulado[] = arestas
    .map((aresta) => {
      const source = porId.get(aresta.de);
      const target = porId.get(aresta.para);
      return source && target ? { source, target } : null;
    })
    .filter((link): link is LinkSimulado => link !== null);

  const simulacao = forceSimulation(nosSimulados)
    .force(
      "link",
      forceLink<NoSimulado, LinkSimulado>(links)
        .id((n) => n.id)
        .distance(forcas.distanciaDoLink)
        // A divisão pelo menor grau é a força padrão do d3: um hub não
        // arrasta as folhas atrás de si. O slider só a escala.
        .strength(
          (link) => forcas.link / Math.max(1, Math.min(grau(link.source.id), grau(link.target.id))),
        ),
    )
    .force(
      "carga",
      forceManyBody()
        .strength(-forcas.repulsao)
        .distanceMin(DISTANCIA_MINIMA_DE_REPULSAO)
        .theta(THETA_DA_REPULSAO),
    )
    .force("centroX", forceX<NoSimulado>(0).strength(forcas.centralizacao))
    .force("centroY", forceY<NoSimulado>(0).strength(forcas.centralizacao))
    .force("colisao", forceCollide<NoSimulado>(RAIO_DE_COLISAO).strength(FORCA_DE_COLISAO));

  // A simulação já vem rodando num timer próprio; paramos e resolvemos de uma vez.
  simulacao.stop();
  simulacao.tick(passos);

  return { nos: nosSimulados, links, simulacao };
}
