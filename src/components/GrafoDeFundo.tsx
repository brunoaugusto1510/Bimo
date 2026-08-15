"use client";

import { useEffect, useRef } from "react";
import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation } from "d3-force";
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

const RAIO_BASE = 2;
const RAIO_POR_LIGACAO = 0.8;
const RAIO_MAXIMO = 11;
/** Quanto uma bolinha se afasta da sua posição de repouso, em pixels. */
const AMPLITUDE_BASE = 1;
/** Multiplicador da amplitude logo após um pulso — decai a cada quadro até voltar a 1. */
const PULSO_INICIAL = 6;
const DECAIMENTO_DO_PULSO = 0.96;

/**
 * Grafo de fundo, no estilo "grafo local" do Obsidian: cada nota é uma
 * bolinha, cada link vira uma linha. Fica atrás do chat, sempre com um leve
 * movimento (uma "respiração" por cima da posição calculada pela física),
 * que se intensifica por um instante a cada resposta do agente.
 *
 * A física (onde cada bolinha deveria ficar, para as ligadas ficarem perto
 * uma da outra e as demais não se sobrepor) vem do d3-force — não faz sentido
 * reescrever repulsão/atração de partículas do zero. A "respiração" e o pulso
 * são nossos, desenhados por cima com um loop de animação próprio.
 */
export default function GrafoDeFundo({ nos, arestas, notaAberta, pulso, onAbrirNota }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const nosSimuladosRef = useRef<NoSimulado[]>([]);
  const linksSimuladosRef = useRef<LinkSimulado[]>([]);
  const intensidadeRef = useRef(1);
  const onAbrirNotaRef = useRef(onAbrirNota);

  // Refs não são lidos durante a renderização — só dentro de efeitos ou
  // handlers de evento. Por isso a atualização do valor mora aqui, e não
  // direto no corpo do componente.
  useEffect(() => {
    onAbrirNotaRef.current = onAbrirNota;
  }, [onAbrirNota]);

  // Monta a simulação de física uma vez por conjunto de nós/arestas (ela reordena
  // e anima sozinha depois disso — não precisa recriar a cada render).
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
          .distance(70),
      )
      .force("carga", forceManyBody().strength(-90))
      .force("centro", forceCenter(largura / 2, altura / 2))
      .force(
        "colisao",
        forceCollide<NoSimulado>((n) => raioDoNo(n, grauPorCaminho) + 4),
      );

    return () => {
      simulacao.stop();
    };
  }, [nos, arestas]);

  // Dispara o pulso: um instante de amplitude maior, que decai sozinho a cada quadro.
  useEffect(() => {
    if (pulso > 0) intensidadeRef.current = PULSO_INICIAL;
  }, [pulso]);

  // O loop de desenho: roda pra sempre em requestAnimationFrame, separado da
  // simulação de física. Lê as posições calculadas por ela e soma uma
  // oscilação própria por cima — é isso que faz o grafo nunca ficar parado.
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const contexto = canvas.getContext("2d");
    if (!contexto) return;

    const estilo = getComputedStyle(document.documentElement);
    const corLinha = estilo.getPropertyValue("--borda").trim() || "#e3e3e6";
    const corNo = estilo.getPropertyValue("--texto-suave").trim() || "#6b6b73";
    const corDestaque = estilo.getPropertyValue("--destaque").trim() || "#5bd088";

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

    function desenhar(tempoMs: number) {
      if (!animando) return;
      const tempo = tempoMs / 1000;
      const largura = container!.clientWidth;
      const altura = container!.clientHeight;

      contexto!.clearRect(0, 0, largura, altura);

      // Linhas primeiro, para as bolinhas ficarem por cima.
      contexto!.strokeStyle = corLinha;
      contexto!.lineWidth = 1;
      for (const link of linksSimuladosRef.current) {
        const de = posicaoVisual(link.source, tempo);
        const para = posicaoVisual(link.target, tempo);
        contexto!.beginPath();
        contexto!.moveTo(de.x, de.y);
        contexto!.lineTo(para.x, para.y);
        contexto!.stroke();
      }

      for (const no of nosSimuladosRef.current) {
        const pos = posicaoVisual(no, tempo);
        const raio = raioDoNo(no, grauPorCaminho);
        const aberta = no.caminho === notaAberta;

        contexto!.beginPath();
        contexto!.arc(pos.x, pos.y, aberta ? raio + 2 : raio, 0, Math.PI * 2);
        contexto!.fillStyle = aberta ? corDestaque : corNo;
        contexto!.globalAlpha = aberta ? 1 : 0.75;
        contexto!.fill();
      }
      contexto!.globalAlpha = 1;

      // O pulso decai geometricamente até voltar à amplitude normal (1).
      intensidadeRef.current = 1 + (intensidadeRef.current - 1) * DECAIMENTO_DO_PULSO;

      requestAnimationFrame(desenhar);
    }

    const quadro = requestAnimationFrame(desenhar);

    function aoClicar(evento: MouseEvent) {
      const retangulo = canvas!.getBoundingClientRect();
      const x = evento.clientX - retangulo.left;
      const y = evento.clientY - retangulo.top;
      const tempo = performance.now() / 1000;

      for (const no of nosSimuladosRef.current) {
        const pos = posicaoVisual(no, tempo);
        const raio = raioDoNo(no, grauPorCaminho) + 4; // +4: margem de toque mais generosa que o desenho
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
  }, [notaAberta]);

  return (
    <div ref={containerRef} className="absolute inset-0 -z-0">
      <canvas ref={canvasRef} className="h-full w-full cursor-pointer" />
    </div>
  );
}

function raioDoNo(no: { caminho: string }, grauPorCaminho: Map<string, number>): number {
  const grau = grauPorCaminho.get(no.caminho) ?? 0;
  return Math.min(RAIO_BASE + grau * RAIO_POR_LIGACAO, RAIO_MAXIMO);
}
