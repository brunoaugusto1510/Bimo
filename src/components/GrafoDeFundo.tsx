"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
} from "d3-force";
import { criarMapaDeCoresPorGrupo, NUMERO_DE_CORES_DE_GRUPO } from "@/lib/cores-grupo";
import {
  DISTANCIA_MINIMA_DE_REPULSAO,
  FORCA_DE_COLISAO,
  RAIO_DE_COLISAO,
  RAIO_MAXIMO_DO_NO,
  THETA_DA_REPULSAO,
  calcularGraus,
  converterParaForcas,
  raioDoNo,
  type ConfiguracaoDoGrafo,
} from "@/lib/fisica-do-grafo";
import type { ArestaDoGrafo, NoDoGrafo } from "@/lib/grafo";

type NoSimulado = NoDoGrafo & {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Fase e frequência próprias, para a "respiração" de cada bolinha não ficar em sincronia. */
  fase: number;
  frequencia: number;
};

type LinkSimulado = { source: NoSimulado; target: NoSimulado };

type Props = {
  nos: NoDoGrafo[];
  arestas: ArestaDoGrafo[];
  /** Vem do `.obsidian/graph.json` do vault — decide forças e tamanho dos nós. */
  configuracao: ConfiguracaoDoGrafo;
  /** Caminho da nota destacada (aberta no leitor agora), ou null. */
  notaAberta: string | null;
  /** Incrementa a cada resposta do agente — dispara um pulso de movimento. */
  pulso: number;
  onAbrirNota: (caminho: string) => void;
};

/*
 * A física segue a do graph view do Obsidian (ver `fisica-do-grafo.ts`): cada
 * nó é puxado para a origem por forceX/Y — não `forceCenter`, que só desloca
 * o conjunto sem atrair nó nenhum —, os links são molas cuja força cai com o
 * grau das pontas, todos se repelem e ninguém se sobrepõe. As forças vêm do
 * `graph.json` do vault; o zoom-to-fit abaixo é que faz o resultado caber na
 * tela, seja qual for a escala do layout.
 */

/** Quanto uma bolinha se afasta da sua posição de repouso, em pixels de tela. */
const AMPLITUDE_BASE = 1;
/** Multiplicador da amplitude logo após um pulso — decai a cada quadro até voltar a 1. */
const PULSO_INICIAL = 6;
const DECAIMENTO_DO_PULSO = 0.96;

/** Fração da área do canvas que o "zoom out" tenta preencher — sobra de respiro nas bordas. */
const MARGEM_DE_ZOOM = 0.94;
/**
 * Passos de física rodados de uma vez, antes do primeiro desenho: o layout já
 * nasce pronto. Depender de acumular quadros desenhava com o zoom errado onde o
 * `requestAnimationFrame` vem estrangulado (aba em segundo plano, headless).
 * Com o decaimento padrão do d3 a simulação esfria em ~300 passos.
 */
const PASSOS_DE_ACOMODACAO = 400;
/** Suaviza a escala quando o painel muda de tamanho. No primeiro quadro ela já assume o valor certo. */
const SUAVIZACAO_DO_ZOOM = 0.06;
/** Raio mínimo na tela — mantém tudo visível e clicável mesmo bem afastado. */
const RAIO_MINIMO_NA_TELA = 1.2;
/**
 * Piso do raio na tela, proporcional ao tamanho do nó. Com as forças do
 * Obsidian o layout ocupa milhares de unidades, e o zoom-to-fit afasta tanto
 * (escala ~0,06 num vault de ~400 notas) que todo nó viraria um ponto de
 * 1 px — os hubs sumiriam. Com o piso, afastado um nó de raio 8 fica com
 * ~1,4 px e um de raio 30 com ~5,4 px; de perto, vale a escala real.
 */
const PISO_DO_RAIO_NA_TELA = 0.18;
/** Translúcidas de propósito: centenas de arestas somam brilho e roubam a cena das notas. */
const OPACIDADE_DAS_LINHAS = 0.4;
const OPACIDADE_DOS_NOS = 0.75;
/** Links para notas que ainda não existem aparecem apagados, como no Obsidian. */
const OPACIDADE_DAS_NAO_RESOLVIDAS = 0.4;

/**
 * Grafo de fundo no estilo do graph view do Obsidian: cada nota é uma bolinha
 * colorida pela pasta de topo, cada link uma linha; links quebrados e tags
 * viram nós próprios. A física vem do d3-force; a "respiração", o pulso e o
 * zoom-to-fit são desenhados por cima, num loop nosso.
 */
export default function GrafoDeFundo({
  nos,
  arestas,
  configuracao,
  notaAberta,
  pulso,
  onAbrirNota,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const nosSimuladosRef = useRef<NoSimulado[]>([]);
  const linksSimuladosRef = useRef<LinkSimulado[]>([]);
  const intensidadeRef = useRef(1);
  const onAbrirNotaRef = useRef(onAbrirNota);
  // Estado do zoom, compartilhado com o clique — que precisa saber onde cada nó
  // está desenhado agora. `zoomIniciado` falso = primeiro quadro de um layout novo.
  const escalaRef = useRef(1);
  const centroDoBboxRef = useRef({ x: 0, y: 0 });
  const zoomIniciadoRef = useRef(false);

  const mapaDeCores = useMemo(
    () => criarMapaDeCoresPorGrupo(nos.flatMap((n) => (n.tipo === "nota" ? [n.grupo] : []))),
    [nos],
  );
  const grauPorId = useMemo(() => calcularGraus(arestas), [arestas]);
  const multiplicadorDeTamanho = configuracao.nodeSizeMultiplier;

  useEffect(() => {
    onAbrirNotaRef.current = onAbrirNota;
  }, [onAbrirNota]);

  useEffect(() => {
    if (nos.length === 0) {
      nosSimuladosRef.current = [];
      linksSimuladosRef.current = [];
      return;
    }

    const forcas = converterParaForcas(configuracao);
    const grau = (id: string) => grauPorId.get(id) ?? 0;

    // Posição inicial num disco em volta da origem, com área proporcional ao
    // número de nós — começar tudo amontoado faz a repulsão explodir o layout.
    const raioInicial = (forcas.distanciaDoLink * Math.sqrt(nos.length)) / 2;
    const nosSimulados: NoSimulado[] = nos.map((no) => {
      const angulo = Math.random() * Math.PI * 2;
      const distancia = Math.sqrt(Math.random()) * raioInicial;
      return {
        ...no,
        x: Math.cos(angulo) * distancia,
        y: Math.sin(angulo) * distancia,
        vx: 0,
        vy: 0,
        fase: Math.random() * Math.PI * 2,
        frequencia: 0.4 + Math.random() * 0.5,
      };
    });
    const porId = new Map(nosSimulados.map((n) => [n.id, n]));

    const linksSimulados: LinkSimulado[] = arestas
      .map((aresta) => {
        const source = porId.get(aresta.de);
        const target = porId.get(aresta.para);
        return source && target ? { source, target } : null;
      })
      .filter((link): link is LinkSimulado => link !== null);

    nosSimuladosRef.current = nosSimulados;
    linksSimuladosRef.current = linksSimulados;

    const simulacao = forceSimulation(nosSimulados)
      .force(
        "link",
        forceLink<NoSimulado, LinkSimulado>(linksSimulados)
          .id((n) => n.id)
          .distance(forcas.distanciaDoLink)
          // A divisão pelo menor grau é a força padrão do d3: um hub não
          // arrasta as folhas atrás de si. O slider só a escala.
          .strength(
            (link) =>
              forcas.link / Math.max(1, Math.min(grau(link.source.id), grau(link.target.id))),
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
    simulacao.tick(PASSOS_DE_ACOMODACAO);
    zoomIniciadoRef.current = false;

    return () => {
      simulacao.stop();
    };
  }, [nos, arestas, configuracao, grauPorId]);

  useEffect(() => {
    if (pulso > 0) intensidadeRef.current = PULSO_INICIAL;
  }, [pulso]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const contexto = canvas.getContext("2d");
    if (!contexto) return;

    const estilo = getComputedStyle(document.documentElement);
    const corLinha = estilo.getPropertyValue("--borda").trim() || "#e7e3d9";
    const corDestaque = estilo.getPropertyValue("--destaque").trim() || "#2574e0";
    const corNaoResolvida = estilo.getPropertyValue("--texto-suave").trim() || "#8b8f94";
    const corTag = estilo.getPropertyValue("--grafo-tag").trim() || "#5f8f8b";
    const paletaDeCores = Array.from({ length: NUMERO_DE_CORES_DE_GRUPO }, (_, i) =>
      estilo.getPropertyValue(`--grafo-cor-${i + 1}`).trim() || "#6b6b73",
    );

    function corDoNo(no: NoSimulado): string {
      if (no.tipo === "nota") return paletaDeCores[mapaDeCores.get(no.grupo) ?? 0];
      return no.tipo === "tag" ? corTag : corNaoResolvida;
    }

    function raioNaTela(no: NoSimulado): number {
      const raio = raioDoNo(grauPorId.get(no.id) ?? 0, multiplicadorDeTamanho);
      return Math.max(raio * escalaRef.current, raio * PISO_DO_RAIO_NA_TELA, RAIO_MINIMO_NA_TELA);
    }

    let animando = true;

    function ajustarTamanho() {
      const dpr = window.devicePixelRatio || 1;
      canvas!.width = container!.clientWidth * dpr;
      canvas!.height = container!.clientHeight * dpr;
      canvas!.style.width = `${container!.clientWidth}px`;
      canvas!.style.height = `${container!.clientHeight}px`;
      contexto!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    const observador = new ResizeObserver(ajustarTamanho);
    observador.observe(container);
    ajustarTamanho();

    /**
     * Posição com a "respiração" somada. A oscilação é em pixels de tela, por
     * isso é dividida pela escala: com o grafo muito afastado, ela seria
     * invisível se fosse medida em unidades da simulação.
     */
    function posicaoVisual(no: NoSimulado, tempo: number) {
      const amplitude = (AMPLITUDE_BASE * intensidadeRef.current) / Math.max(escalaRef.current, 1e-6);
      return {
        x: no.x + Math.sin(tempo * no.frequencia + no.fase) * amplitude,
        y: no.y + Math.cos(tempo * no.frequencia * 0.8 + no.fase) * amplitude,
      };
    }

    /** Retângulo que envolve todos os nós, em espaço de simulação (sem a "respiração"). */
    function calcularBboxDosNos(nos: NoSimulado[]) {
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      for (const no of nos) {
        if (no.x < minX) minX = no.x;
        if (no.x > maxX) maxX = no.x;
        if (no.y < minY) minY = no.y;
        if (no.y > maxY) maxY = no.y;
      }
      const margem = RAIO_MAXIMO_DO_NO * multiplicadorDeTamanho * 2;
      return {
        largura: Math.max(maxX - minX + margem, 1),
        altura: Math.max(maxY - minY + margem, 1),
        centro: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 },
      };
    }

    /** Simulação -> tela, com a escala e o centro do último quadro desenhado. */
    function paraTela(pos: { x: number; y: number }) {
      return {
        x: container!.clientWidth / 2 + (pos.x - centroDoBboxRef.current.x) * escalaRef.current,
        y: container!.clientHeight / 2 + (pos.y - centroDoBboxRef.current.y) * escalaRef.current,
      };
    }

    function desenhar(tempoMs: number) {
      if (!animando) return;
      const tempo = tempoMs / 1000;
      const largura = container!.clientWidth;
      const altura = container!.clientHeight;

      contexto!.clearRect(0, 0, largura, altura);

      // Zoom-to-fit: nada na física garante que os nós caibam no canvas (não há
      // força de contenção), então escalamos o desenho pra caber. O teto em 1
      // faz o zoom só afastar, nunca ampliar um grafo pequeno.
      const bbox = calcularBboxDosNos(nosSimuladosRef.current);
      const escalaAlvo = Math.min(
        1,
        (largura * MARGEM_DE_ZOOM) / bbox.largura,
        (altura * MARGEM_DE_ZOOM) / bbox.altura,
      );
      if (zoomIniciadoRef.current) {
        escalaRef.current += (escalaAlvo - escalaRef.current) * SUAVIZACAO_DO_ZOOM;
      } else {
        escalaRef.current = escalaAlvo;
        zoomIniciadoRef.current = true;
      }
      centroDoBboxRef.current = bbox.centro;

      // Linhas primeiro, para as bolinhas ficarem por cima.
      contexto!.strokeStyle = corLinha;
      contexto!.lineWidth = 1;
      contexto!.globalAlpha = OPACIDADE_DAS_LINHAS;
      for (const link of linksSimuladosRef.current) {
        const de = paraTela(posicaoVisual(link.source, tempo));
        const para = paraTela(posicaoVisual(link.target, tempo));
        contexto!.beginPath();
        contexto!.moveTo(de.x, de.y);
        contexto!.lineTo(para.x, para.y);
        contexto!.stroke();
      }

      for (const no of nosSimuladosRef.current) {
        const pos = paraTela(posicaoVisual(no, tempo));
        const raio = raioNaTela(no);
        const aberta = no.tipo === "nota" && no.id === notaAberta;

        contexto!.beginPath();
        contexto!.arc(pos.x, pos.y, aberta ? raio + 2 : raio, 0, Math.PI * 2);
        contexto!.fillStyle = aberta ? corDestaque : corDoNo(no);
        contexto!.globalAlpha = aberta
          ? 1
          : no.tipo === "nao-resolvida"
            ? OPACIDADE_DAS_NAO_RESOLVIDAS
            : OPACIDADE_DOS_NOS;
        contexto!.fill();
      }
      contexto!.globalAlpha = 1;

      intensidadeRef.current = 1 + (intensidadeRef.current - 1) * DECAIMENTO_DO_PULSO;

      requestAnimationFrame(desenhar);
    }

    const quadro = requestAnimationFrame(desenhar);

    function aoClicar(evento: MouseEvent) {
      const retangulo = canvas!.getBoundingClientRect();
      const x = evento.clientX - retangulo.left;
      const y = evento.clientY - retangulo.top;
      const tempo = performance.now() / 1000;

      // Afastado, nós vizinhos ficam a poucos pixels e as áreas de toque se
      // sobrepõem — abre o mais próximo do clique, não o primeiro da lista.
      let maisProximo: { id: string; distancia2: number } | null = null;
      for (const no of nosSimuladosRef.current) {
        // Só nota existe como arquivo — tag e link quebrado não têm o que abrir.
        if (no.tipo !== "nota") continue;
        // Mesma conversão do último quadro desenhado — é onde o usuário está clicando.
        const pos = paraTela(posicaoVisual(no, tempo));
        // +4: margem de toque mais generosa que o desenho.
        const raio = raioNaTela(no) + 4;
        const distancia2 = (pos.x - x) ** 2 + (pos.y - y) ** 2;
        if (distancia2 <= raio ** 2 && (!maisProximo || distancia2 < maisProximo.distancia2)) {
          maisProximo = { id: no.id, distancia2 };
        }
      }
      if (maisProximo) onAbrirNotaRef.current(maisProximo.id);
    }
    canvas.addEventListener("click", aoClicar);

    return () => {
      animando = false;
      cancelAnimationFrame(quadro);
      observador.disconnect();
      canvas.removeEventListener("click", aoClicar);
    };
  }, [notaAberta, mapaDeCores, grauPorId, multiplicadorDeTamanho]);

  return (
    <div ref={containerRef} className="absolute inset-0 -z-0">
      <canvas ref={canvasRef} className="h-full w-full cursor-pointer" />
    </div>
  );
}
