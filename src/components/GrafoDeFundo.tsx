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
  /** Caminho da nota destacada (aberta no leitor agora), ou null. */
  notaAberta: string | null;
  /** Incrementa a cada resposta do agente — dispara um pulso de movimento. */
  pulso: number;
  onAbrirNota: (caminho: string) => void;
};

const RAIO_BASE = 1;
/** Multiplica a *raiz* do grau: área proporcional ao grau, senão os hubs viram bolas gigantes. */
const RAIO_POR_RAIZ_DAS_LIGACOES = 0.85;
const RAIO_MAXIMO = 5.5;
/** Folga na colisão. Independe do raio: as bolinhas são pequenas mas precisam de respiro. */
const FOLGA_ENTRE_NOS = 5;

/*
 * As quatro forças abaixo são um conjunto calibrado com o vault real (~380
 * notas): mexer numa só costuma piorar. O sinal de que estão no ponto é a
 * escala do zoom ficar perto de 1 (espalhado demais, as bolinhas viram poeira).
 */

/** Curto = estrelinhas compactas com vazio em volta; longo = malha uniforme. Decide os clusters. */
const DISTANCIA_DO_LINK = 16;
/** Negativo empurra. Contra-intuitivo: repulsão alta vence a mola dos links e desfaz os clusters. */
const FORCA_DE_REPULSAO = -70;
/** Teto do alcance da repulsão. Sem ele, cada nota empurra todas e os grupos soltos voam pra longe. */
const ALCANCE_DA_REPULSAO = 230;
/**
 * Fraca de propósito: é a ausência de atração forte que deixa os assuntos se
 * separarem pelos links. Não use `forceCenter` aqui — ele só desloca o conjunto
 * para manter o centro de massa, sem atrair nó nenhum; quem atrai é forceX/Y.
 */
const FORCA_DE_CENTRALIZACAO = 0.06;
/** Quanto uma bolinha se afasta da sua posição de repouso, em pixels. */
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
 */
const PASSOS_DE_ACOMODACAO = 400;
/** Suaviza a escala quando o painel muda de tamanho. No primeiro quadro ela já assume o valor certo. */
const SUAVIZACAO_DO_ZOOM = 0.06;
/** Raio mínimo na tela — mantém tudo visível e clicável mesmo bem afastado. */
const RAIO_MINIMO_NA_TELA = 1.2;
/** Translúcidas de propósito: centenas de arestas somam brilho e roubam a cena das notas. */
const OPACIDADE_DAS_LINHAS = 0.4;

/**
 * Grafo de fundo no estilo "grafo global" do Obsidian: cada nota é uma bolinha
 * colorida pela pasta de topo, cada link uma linha. A física vem do d3-force; a
 * "respiração", o pulso e o zoom-to-fit são desenhados por cima, num loop nosso.
 */
export default function GrafoDeFundo({ nos, arestas, notaAberta, pulso, onAbrirNota }: Props) {
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

  const mapaDeCores = useMemo(() => criarMapaDeCoresPorGrupo(nos.map((n) => n.grupo)), [nos]);

  useEffect(() => {
    onAbrirNotaRef.current = onAbrirNota;
  }, [onAbrirNota]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || nos.length === 0) {
      nosSimuladosRef.current = [];
      linksSimuladosRef.current = [];
      return;
    }

    const largura = container.clientWidth;
    const altura = container.clientHeight;

    const grauPorCaminho = new Map<string, number>();
    for (const aresta of arestas) {
      grauPorCaminho.set(aresta.de, (grauPorCaminho.get(aresta.de) ?? 0) + 1);
      grauPorCaminho.set(aresta.para, (grauPorCaminho.get(aresta.para) ?? 0) + 1);
    }

    const nosSimulados: NoSimulado[] = nos.map((no) => ({
      ...no,
      x: largura / 2 + (Math.random() - 0.5) * largura * 0.6,
      y: altura / 2 + (Math.random() - 0.5) * altura * 0.6,
      vx: 0,
      vy: 0,
      fase: Math.random() * Math.PI * 2,
      frequencia: 0.4 + Math.random() * 0.5,
    }));
    const porCaminho = new Map(nosSimulados.map((n) => [n.caminho, n]));

    const linksSimulados: LinkSimulado[] = arestas
      .map((aresta) => {
        const source = porCaminho.get(aresta.de);
        const target = porCaminho.get(aresta.para);
        return source && target ? { source, target } : null;
      })
      .filter((link): link is LinkSimulado => link !== null);

    nosSimuladosRef.current = nosSimulados;
    linksSimuladosRef.current = linksSimulados;

    const simulacao = forceSimulation(nosSimulados)
      .force(
        "link",
        forceLink<NoSimulado, LinkSimulado>(linksSimulados)
          .id((n) => n.caminho)
          .distance(DISTANCIA_DO_LINK),
      )
      .force("carga", forceManyBody().strength(FORCA_DE_REPULSAO).distanceMax(ALCANCE_DA_REPULSAO))
      .force("centroX", forceX<NoSimulado>(largura / 2).strength(FORCA_DE_CENTRALIZACAO))
      .force("centroY", forceY<NoSimulado>(altura / 2).strength(FORCA_DE_CENTRALIZACAO))
      .force(
        "colisao",
        forceCollide<NoSimulado>((n) => raioDoNo(n, grauPorCaminho) + FOLGA_ENTRE_NOS),
      );

    // A simulação já vem rodando num timer próprio; paramos e resolvemos de uma vez.
    simulacao.stop();
    simulacao.tick(PASSOS_DE_ACOMODACAO);
    zoomIniciadoRef.current = false;

    return () => {
      simulacao.stop();
    };
  }, [nos, arestas]);

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
    const corLinha = estilo.getPropertyValue("--borda").trim() || "#e3e3e6";
    const corDestaque = estilo.getPropertyValue("--destaque").trim() || "#5bd088";
    const paletaDeCores = Array.from({ length: NUMERO_DE_CORES_DE_GRUPO }, (_, i) =>
      estilo.getPropertyValue(`--grafo-cor-${i + 1}`).trim() || "#6b6b73",
    );

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

    const grauPorCaminho = new Map<string, number>();
    for (const link of linksSimuladosRef.current) {
      grauPorCaminho.set(link.source.caminho, (grauPorCaminho.get(link.source.caminho) ?? 0) + 1);
      grauPorCaminho.set(link.target.caminho, (grauPorCaminho.get(link.target.caminho) ?? 0) + 1);
    }

    function posicaoVisual(no: NoSimulado, tempo: number) {
      const amplitude = AMPLITUDE_BASE * intensidadeRef.current;
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
      return {
        largura: Math.max(maxX - minX + RAIO_MAXIMO * 2, 1),
        altura: Math.max(maxY - minY + RAIO_MAXIMO * 2, 1),
        centro: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 },
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

      const escala = escalaRef.current;
      const centroBbox = centroDoBboxRef.current;
      const centroTela = { x: largura / 2, y: altura / 2 };

      function paraTela(pos: { x: number; y: number }) {
        return {
          x: centroTela.x + (pos.x - centroBbox.x) * escala,
          y: centroTela.y + (pos.y - centroBbox.y) * escala,
        };
      }

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
        const raio = Math.max(raioDoNo(no, grauPorCaminho) * escala, RAIO_MINIMO_NA_TELA);
        const aberta = no.caminho === notaAberta;

        contexto!.beginPath();
        contexto!.arc(pos.x, pos.y, aberta ? raio + 2 : raio, 0, Math.PI * 2);
        contexto!.fillStyle = aberta ? corDestaque : paletaDeCores[mapaDeCores.get(no.grupo) ?? 0];
        contexto!.globalAlpha = aberta ? 1 : 0.75;
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

      // Mesma conversão do último quadro desenhado — é onde o usuário está clicando.
      const escala = escalaRef.current;
      const centroBbox = centroDoBboxRef.current;
      const centroTela = { x: container!.clientWidth / 2, y: container!.clientHeight / 2 };

      for (const no of nosSimuladosRef.current) {
        const posSimulada = posicaoVisual(no, tempo);
        const pos = {
          x: centroTela.x + (posSimulada.x - centroBbox.x) * escala,
          y: centroTela.y + (posSimulada.y - centroBbox.y) * escala,
        };
        // +4: margem de toque mais generosa que o desenho.
        const raio = Math.max(raioDoNo(no, grauPorCaminho) * escala, RAIO_MINIMO_NA_TELA) + 4;
        if ((pos.x - x) ** 2 + (pos.y - y) ** 2 <= raio ** 2) {
          onAbrirNotaRef.current(no.caminho);
          return;
        }
      }
    }
    canvas.addEventListener("click", aoClicar);

    return () => {
      animando = false;
      cancelAnimationFrame(quadro);
      observador.disconnect();
      canvas.removeEventListener("click", aoClicar);
    };
  }, [notaAberta, mapaDeCores]);

  return (
    <div ref={containerRef} className="absolute inset-0 -z-0">
      <canvas ref={canvasRef} className="h-full w-full cursor-pointer" />
    </div>
  );
}

function raioDoNo(no: { caminho: string }, grauPorCaminho: Map<string, number>): number {
  const grau = grauPorCaminho.get(no.caminho) ?? 0;
  return Math.min(RAIO_BASE + Math.sqrt(grau) * RAIO_POR_RAIZ_DAS_LIGACOES, RAIO_MAXIMO);
}
