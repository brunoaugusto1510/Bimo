"use client";

import { useEffect, useImperativeHandle, useMemo, useRef, type Ref } from "react";
import type { Simulation } from "d3-force";
import {
  ZOOM_MAXIMO,
  arrastar,
  calcularCaixa,
  encontrarNoEm,
  enquadrar,
  interpolar,
  limitesDeZoom,
  quaseIgual,
  raioNaTela,
  telaParaMundo,
  zoomEmTorno,
  type Camera,
  type Ponto,
} from "@/lib/camera-do-grafo";
import { criarMapaDeCoresPorGrupo, NUMERO_DE_CORES_DE_GRUPO } from "@/lib/cores-grupo";
import { ATRIBUTO_DO_TEMA } from "@/lib/tema";
import {
  RAIO_MAXIMO_DO_NO,
  calcularGraus,
  raioDoNo,
  type ConfiguracaoDoGrafo,
} from "@/lib/fisica-do-grafo";
import type { ArestaDoGrafo, NoDoGrafo } from "@/lib/grafo";
import {
  criarSimulacaoDoGrafo,
  montarVizinhos,
  type LinkSimulado,
  type NoSimulado,
} from "@/lib/simulacao-do-grafo";
import { desenharQuadro, lerCores, type Foco, type NoVisual } from "./desenhar-grafo";

/** Comandos de câmera que a barra do grafo (fora deste componente) dispara. */
export type ControleDoGrafo = {
  aproximar: () => void;
  afastar: () => void;
  /** Volta a mostrar o grafo inteiro. */
  enquadrar: () => void;
  /** Aproxima da nota selecionada e das notas ligadas a ela. */
  enquadrarVizinhos: () => void;
};

type Props = {
  nos: NoDoGrafo[];
  arestas: ArestaDoGrafo[];
  /** Vem do `.obsidian/graph.json` do vault — decide forças e tamanho dos nós. */
  configuracao: ConfiguracaoDoGrafo;
  /** Caminho da nota aberta no leitor agora, ou null — destacada no modo fundo. */
  notaAberta: string | null;
  /** Incrementa a cada resposta do agente — dispara um pulso de movimento. */
  pulso: number;
  /** Modo fundo: clicar numa nota a abre. */
  onAbrirNota: (caminho: string) => void;
  /**
   * Modo interativo (aba Notas): o grafo deixa de ser pano de fundo e vira
   * algo para mexer — arrastar o fundo move a câmera, a roda (ou a pinça) dá
   * zoom, arrastar uma bolinha a puxa junto com as vizinhas e clicar numa nota
   * a seleciona. A simulação é a mesma nos dois modos, então trocar de aba não
   * embaralha o layout.
   */
  interativo?: boolean;
  /** Nota selecionada no modo interativo (controlada por quem usa o componente). */
  selecionado?: string | null;
  onSelecionar?: (caminho: string | null) => void;
  /**
   * Cada incremento pede que a câmera vá até a nota selecionada. É um contador
   * (e não só o `selecionado` mudar) porque escolher de novo a nota que já está
   * selecionada — para reencontrá-la depois de arrastar o grafo — não muda o valor.
   * Selecionar clicando no próprio grafo não incrementa: a nota já está sob o dedo.
   */
  focoPedido?: number;
  controleRef?: Ref<ControleDoGrafo>;
};

/** Multiplicador da amplitude logo após um pulso — decai a cada quadro até voltar a 1. */
const PULSO_INICIAL = 6;
const DECAIMENTO_DO_PULSO = 0.96;

/** Fração da área do canvas que o enquadramento tenta preencher — sobra de respiro nas bordas. */
const MARGEM_DE_ZOOM = 0.94;
/** Suaviza a câmera do modo fundo quando o painel muda de tamanho. No primeiro quadro ela já assume o valor certo. */
const SUAVIZACAO_DO_ZOOM = 0.06;
/** Mais rápida que a do fundo: é a resposta a um botão ou a uma seleção, não um ajuste de layout. */
const SUAVIZACAO_DA_CAMERA = 0.2;

/** Quanto o ponteiro pode andar antes de o toque virar arrasto, em pixels. */
const LIMIAR_DE_ARRASTO = 5;
/** Folga na área de acerto de uma bolinha, em pixels. Dedo é mais grosso que cursor. */
const MARGEM_DO_CLIQUE = 4;
const MARGEM_DO_TOQUE = 10;
const MARGEM_DO_HOVER = 2;
/** Um passo dos botões + e −. */
const FATOR_DOS_BOTOES = 1.5;
const SENSIBILIDADE_DA_RODA = 0.0015;
/** Enquanto uma bolinha é arrastada a simulação fica "quente" nesse nível, e as vizinhas a seguem. */
const ENERGIA_DURANTE_O_ARRASTO = 0.3;
/** Ao mostrar uma nota com as vizinhas: zoom máximo (para uma nota isolada) e fração da tela que o grupo ocupa. */
const ZOOM_MAXIMO_AO_MOSTRAR_NOTA = 2;
const OCUPACAO_AO_MOSTRAR_NOTA = 0.7;

const SEM_VIZINHOS: ReadonlySet<string> = new Set();

type Acoes = ControleDoGrafo & { mostrarNota: (id: string) => void };

const ACOES_VAZIAS: Acoes = {
  aproximar: () => {},
  afastar: () => {},
  enquadrar: () => {},
  enquadrarVizinhos: () => {},
  mostrarNota: () => {},
};

/** O que o ponteiro está fazendo agora. `moveu` separa clique de arrasto. */
type Gesto =
  | { tipo: "nenhum" }
  | { tipo: "fundo"; inicio: Ponto; cameraInicial: Camera; moveu: boolean }
  | { tipo: "no"; no: NoVisual; inicio: Ponto; deslocamento: Ponto; moveu: boolean }
  | { tipo: "pinca"; distanciaInicial: number; centroInicial: Ponto; cameraInicial: Camera };

const SEM_GESTO: Gesto = { tipo: "nenhum" };

function distanciaEntre(a: Ponto, b: Ponto): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function pontoMedio(a: Ponto, b: Ponto): Ponto {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/**
 * Grafo de notas no estilo do graph view do Obsidian: cada nota é uma bolinha
 * colorida pela pasta de topo, cada link uma linha; links quebrados e tags
 * viram nós próprios. A física vem do d3-force (ver `simulacao-do-grafo.ts`);
 * a câmera, em `camera-do-grafo.ts`; o desenho, em `desenhar-grafo.ts`. Aqui
 * ficam o loop de animação e os gestos.
 */
export default function GrafoDeFundo({
  nos,
  arestas,
  configuracao,
  notaAberta,
  pulso,
  onAbrirNota,
  interativo = false,
  selecionado = null,
  onSelecionar,
  focoPedido = 0,
  controleRef,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const nosRef = useRef<NoVisual[]>([]);
  const linksRef = useRef<LinkSimulado[]>([]);
  const simulacaoRef = useRef<Simulation<NoSimulado, undefined> | null>(null);
  const intensidadeRef = useRef(1);

  // Câmera atual e para onde ela está indo. `zoomIniciado` falso = primeiro
  // quadro de um layout novo, que assume o enquadramento sem animar.
  const cameraRef = useRef<Camera>({ x: 0, y: 0, k: 1 });
  const alvoDaCameraRef = useRef<Camera | null>(null);
  const zoomIniciadoRef = useRef(false);
  const hoverRef = useRef<string | null>(null);
  const acoesRef = useRef<Acoes>(ACOES_VAZIAS);

  // As props que o loop e os gestos leem a cada quadro/evento ficam em refs: assim
  // trocar de nota ou de aba não derruba e recria o loop de animação.
  const onAbrirNotaRef = useRef(onAbrirNota);
  const onSelecionarRef = useRef(onSelecionar);
  const interativoRef = useRef(interativo);
  const selecionadoRef = useRef(selecionado);
  const notaAbertaRef = useRef(notaAberta);

  const mapaDeCores = useMemo(
    () => criarMapaDeCoresPorGrupo(nos.flatMap((n) => (n.tipo === "nota" ? [n.grupo] : []))),
    [nos],
  );
  const grauPorId = useMemo(() => calcularGraus(arestas), [arestas]);
  const vizinhosPorId = useMemo(() => montarVizinhos(arestas), [arestas]);
  const multiplicadorDeTamanho = configuracao.nodeSizeMultiplier;

  useEffect(() => {
    onAbrirNotaRef.current = onAbrirNota;
    onSelecionarRef.current = onSelecionar;
    interativoRef.current = interativo;
    selecionadoRef.current = selecionado;
    notaAbertaRef.current = notaAberta;
  });

  useImperativeHandle(
    controleRef,
    () => ({
      aproximar: () => acoesRef.current.aproximar(),
      afastar: () => acoesRef.current.afastar(),
      enquadrar: () => acoesRef.current.enquadrar(),
      enquadrarVizinhos: () => acoesRef.current.enquadrarVizinhos(),
    }),
    [],
  );

  useEffect(() => {
    if (nos.length === 0) {
      nosRef.current = [];
      linksRef.current = [];
      simulacaoRef.current = null;
      return;
    }

    const { nos: nosSimulados, links, simulacao } = criarSimulacaoDoGrafo({
      nos,
      arestas,
      configuracao,
      graus: grauPorId,
    });

    // A simulação mexe nestes mesmos objetos; a fase da "respiração" só entra por cima.
    nosRef.current = nosSimulados.map((no) =>
      Object.assign(no, { fase: Math.random() * Math.PI * 2, frequencia: 0.4 + Math.random() * 0.5 }),
    );
    linksRef.current = links;
    simulacaoRef.current = simulacao;
    zoomIniciadoRef.current = false;
    alvoDaCameraRef.current = null;

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

    // `let`: o tema pode mudar com a página aberta (o botão do header, ou o
    // sistema no modo automático), e o canvas não enxerga o CSS sozinho — as
    // cores são relidas quando o atributo `data-tema` do <html> muda.
    let cores = lerCores(NUMERO_DE_CORES_DE_GRUPO);
    const observadorDoTema = new MutationObserver(() => {
      cores = lerCores(NUMERO_DE_CORES_DE_GRUPO);
    });
    observadorDoTema.observe(document.documentElement, {
      attributes: true,
      attributeFilter: [ATRIBUTO_DO_TEMA],
    });

    const corDoNo = (no: NoVisual): string => {
      if (no.tipo === "nota") return cores.paleta[mapaDeCores.get(no.grupo) ?? 0];
      return no.tipo === "tag" ? cores.tag : cores.naoResolvida;
    };
    const raioDe = (no: NoVisual): number =>
      raioNaTela(raioDoNo(grauPorId.get(no.id) ?? 0, multiplicadorDeTamanho), cameraRef.current.k);

    const tamanho = () => ({ largura: container.clientWidth, altura: container.clientHeight });

    const ajustarTamanho = () => {
      const dpr = window.devicePixelRatio || 1;
      const { largura, altura } = tamanho();
      canvas.width = largura * dpr;
      canvas.height = altura * dpr;
      canvas.style.width = `${largura}px`;
      canvas.style.height = `${altura}px`;
      contexto.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const observador = new ResizeObserver(ajustarTamanho);
    observador.observe(container);
    ajustarTamanho();

    // --- Câmera -----------------------------------------------------------

    /**
     * A câmera que faz o grafo inteiro caber. Nada na física garante que os nós
     * caibam no canvas (não há força de contenção), então a câmera é que se
     * ajusta. O teto em 1 faz o zoom só afastar, nunca ampliar um grafo pequeno.
     */
    const enquadramentoDoGrafo = (): Camera | null => {
      const caixa = calcularCaixa(nosRef.current);
      if (!caixa) return null;
      const { largura, altura } = tamanho();
      return enquadrar(caixa, largura, altura, {
        margem: RAIO_MAXIMO_DO_NO * multiplicadorDeTamanho * 2,
        ocupacao: MARGEM_DE_ZOOM,
        zoomMaximo: 1,
      });
    };

    const limitesAtuais = () => limitesDeZoom(enquadramentoDoGrafo()?.k ?? 1);

    const atualizarCamera = () => {
      const enquadramento = enquadramentoDoGrafo();
      if (!enquadramento) return;

      if (!zoomIniciadoRef.current) {
        cameraRef.current = enquadramento;
        zoomIniciadoRef.current = true;
        return;
      }

      // Modo fundo: a câmera acompanha o enquadramento — se o painel muda de tamanho, ela desliza.
      if (!interativoRef.current) {
        alvoDaCameraRef.current = null;
        cameraRef.current = interpolar(cameraRef.current, enquadramento, SUAVIZACAO_DO_ZOOM);
        return;
      }

      // Modo interativo: a câmera é do usuário; só anima rumo a um destino que um botão ou uma seleção pediu.
      const alvo = alvoDaCameraRef.current;
      if (!alvo) return;
      cameraRef.current = interpolar(cameraRef.current, alvo, SUAVIZACAO_DA_CAMERA);
      if (quaseIgual(cameraRef.current, alvo)) {
        cameraRef.current = alvo;
        alvoDaCameraRef.current = null;
      }
    };

    const zoomDosBotoes = (fator: number) => {
      const { largura, altura } = tamanho();
      alvoDaCameraRef.current = zoomEmTorno(
        cameraRef.current,
        { x: largura / 2, y: altura / 2 },
        fator,
        limitesAtuais(),
      );
    };

    /**
     * Leva a câmera até a nota e mostra junto as ligadas a ela — é o que dá
     * contexto: só centralizar numa nota, de perto, deixava as vizinhas fora
     * da tela. Uma nota sem ligações (grupo de um nó só) fica no meio, no zoom máximo.
     */
    const mostrarNota = (id: string) => {
      const grupo = new Set([id, ...(vizinhosPorId.get(id) ?? SEM_VIZINHOS)]);
      const caixa = calcularCaixa(nosRef.current.filter((no) => grupo.has(no.id)));
      if (!caixa) return;
      const { largura, altura } = tamanho();
      alvoDaCameraRef.current = enquadrar(caixa, largura, altura, {
        margem: RAIO_MAXIMO_DO_NO * multiplicadorDeTamanho * 4,
        ocupacao: OCUPACAO_AO_MOSTRAR_NOTA,
        zoomMaximo: Math.min(ZOOM_MAXIMO, ZOOM_MAXIMO_AO_MOSTRAR_NOTA),
      });
    };

    acoesRef.current = {
      aproximar: () => zoomDosBotoes(FATOR_DOS_BOTOES),
      afastar: () => zoomDosBotoes(1 / FATOR_DOS_BOTOES),
      enquadrar: () => {
        const enquadramento = enquadramentoDoGrafo();
        if (enquadramento) alvoDaCameraRef.current = enquadramento;
      },
      enquadrarVizinhos: () => {
        const id = selecionadoRef.current;
        if (id) mostrarNota(id);
      },
      mostrarNota,
    };

    // --- Loop ---------------------------------------------------------------

    /** No modo interativo a física segue viva só enquanto há energia (uma bolinha sendo arrastada, o layout se acomodando). */
    const avancarFisica = () => {
      const simulacao = simulacaoRef.current;
      if (!interativoRef.current || !simulacao) return;
      if (simulacao.alpha() >= simulacao.alphaMin() || simulacao.alphaTarget() > 0) simulacao.tick();
    };

    let focoEmCache: { id: string | null; foco: Foco | null } = { id: null, foco: null };
    const focoAtual = (): Foco | null => {
      const id = interativoRef.current ? selecionadoRef.current : null;
      if (id !== focoEmCache.id) {
        // A barra lateral lista todas as notas, mas o grafo tem um teto (`MAX_NOTAS_NO_GRAFO`):
        // uma nota que ficou de fora não tem nó para destacar, e tratá-la como foco só apagaria o resto.
        const noExiste = id !== null && nosRef.current.some((no) => no.id === id);
        focoEmCache = {
          id,
          foco: noExiste ? { id, vizinhos: vizinhosPorId.get(id) ?? SEM_VIZINHOS } : null,
        };
      }
      return focoEmCache.foco;
    };

    let animando = true;
    let idDoQuadro = 0;

    const quadro = (tempoMs: number) => {
      if (!animando) return;
      const { largura, altura } = tamanho();

      // Painel escondido (aba trocada, menu aberto no celular) tem tamanho 0: não há o que desenhar.
      if (largura > 0 && altura > 0) {
        atualizarCamera();
        avancarFisica();
        desenharQuadro(contexto, {
          largura,
          altura,
          camera: cameraRef.current,
          tempo: tempoMs / 1000,
          intensidade: intensidadeRef.current,
          interativo: interativoRef.current,
          notaAberta: notaAbertaRef.current,
          foco: focoAtual(),
          hover: hoverRef.current,
          nos: nosRef.current,
          links: linksRef.current,
          cores,
          corDoNo,
          raioNaTela: raioDe,
        });
      }

      intensidadeRef.current = 1 + (intensidadeRef.current - 1) * DECAIMENTO_DO_PULSO;
      idDoQuadro = requestAnimationFrame(quadro);
    };
    idDoQuadro = requestAnimationFrame(quadro);

    // --- Gestos -------------------------------------------------------------

    const ponteiros = new Map<number, Ponto>();
    let gesto: Gesto = SEM_GESTO;

    const pontoDoEvento = (evento: MouseEvent): Ponto => {
      const retangulo = canvas.getBoundingClientRect();
      return { x: evento.clientX - retangulo.left, y: evento.clientY - retangulo.top };
    };

    const noEm = (ponto: Ponto, margem: number, apenasNotas = false): NoVisual | null =>
      encontrarNoEm(
        apenasNotas ? nosRef.current.filter((no) => no.tipo === "nota") : nosRef.current,
        cameraRef.current,
        ponto,
        raioDe,
        margem,
      );

    const selecionar = (id: string | null) => onSelecionarRef.current?.(id);

    /** Solta a bolinha que estava sendo arrastada: volta a obedecer à física e a simulação esfria. */
    const soltarNo = (no: NoVisual) => {
      no.fx = null;
      no.fy = null;
      simulacaoRef.current?.alphaTarget(0);
    };

    const iniciarPinca = (): Gesto => {
      const [a, b] = [...ponteiros.values()];
      return {
        tipo: "pinca",
        distanciaInicial: Math.max(distanciaEntre(a, b), 1),
        centroInicial: pontoMedio(a, b),
        cameraInicial: cameraRef.current,
      };
    };

    const atualizarHover = (ponto: Ponto) => {
      const no = noEm(ponto, MARGEM_DO_HOVER);
      hoverRef.current = no?.id ?? null;
      // Só nota abre/seleciona: o cursor de "clicável" é dela; o resto só se arrasta.
      canvas.style.cursor = no?.tipo === "nota" ? "pointer" : "";
    };

    const aoPressionar = (evento: PointerEvent) => {
      if (!interativoRef.current) return;
      if (evento.pointerType === "mouse" && evento.button !== 0) return;

      try {
        // Mantém os eventos chegando mesmo se o ponteiro sair do canvas durante o arrasto.
        canvas.setPointerCapture(evento.pointerId);
      } catch {
        // O ponteiro pode já ter sido solto (toque muito curto): o gesto segue sem captura.
      }
      const ponto = pontoDoEvento(evento);
      ponteiros.set(evento.pointerId, ponto);
      alvoDaCameraRef.current = null;

      if (ponteiros.size >= 2) {
        if (gesto.tipo === "no" && gesto.moveu) soltarNo(gesto.no);
        gesto = iniciarPinca();
        return;
      }

      const no = noEm(ponto, evento.pointerType === "touch" ? MARGEM_DO_TOQUE : MARGEM_DO_CLIQUE);
      if (no) {
        const mundo = telaParaMundo(cameraRef.current, ponto);
        gesto = {
          tipo: "no",
          no,
          inicio: ponto,
          deslocamento: { x: no.x - mundo.x, y: no.y - mundo.y },
          moveu: false,
        };
      } else {
        gesto = { tipo: "fundo", inicio: ponto, cameraInicial: cameraRef.current, moveu: false };
      }
      canvas.style.cursor = "grabbing";
    };

    const aoMover = (evento: PointerEvent) => {
      const ponto = pontoDoEvento(evento);
      if (ponteiros.has(evento.pointerId)) ponteiros.set(evento.pointerId, ponto);
      if (!interativoRef.current) return;

      switch (gesto.tipo) {
        case "fundo": {
          const dx = ponto.x - gesto.inicio.x;
          const dy = ponto.y - gesto.inicio.y;
          if (!gesto.moveu && Math.hypot(dx, dy) < LIMIAR_DE_ARRASTO) return;
          gesto = { ...gesto, moveu: true };
          cameraRef.current = arrastar(gesto.cameraInicial, dx, dy);
          return;
        }
        case "no": {
          if (!gesto.moveu && distanciaEntre(ponto, gesto.inicio) < LIMIAR_DE_ARRASTO) return;
          if (!gesto.moveu) {
            gesto = { ...gesto, moveu: true };
            simulacaoRef.current?.alphaTarget(ENERGIA_DURANTE_O_ARRASTO);
          }
          const mundo = telaParaMundo(cameraRef.current, ponto);
          gesto.no.fx = mundo.x + gesto.deslocamento.x;
          gesto.no.fy = mundo.y + gesto.deslocamento.y;
          return;
        }
        case "pinca": {
          if (ponteiros.size < 2) return;
          const [a, b] = [...ponteiros.values()];
          const centro = pontoMedio(a, b);
          const comZoom = zoomEmTorno(
            gesto.cameraInicial,
            gesto.centroInicial,
            distanciaEntre(a, b) / gesto.distanciaInicial,
            limitesAtuais(),
          );
          cameraRef.current = arrastar(
            comZoom,
            centro.x - gesto.centroInicial.x,
            centro.y - gesto.centroInicial.y,
          );
          return;
        }
        default:
          if (evento.pointerType === "mouse") atualizarHover(ponto);
      }
    };

    const aoSoltar = (evento: PointerEvent) => {
      ponteiros.delete(evento.pointerId);
      if (canvas.hasPointerCapture(evento.pointerId)) canvas.releasePointerCapture(evento.pointerId);
      if (!interativoRef.current) {
        gesto = SEM_GESTO;
        return;
      }

      // `pointercancel` (o sistema tomou o toque) nunca vale como clique.
      const foiClique = evento.type === "pointerup";

      if (gesto.tipo === "no") {
        if (gesto.moveu) soltarNo(gesto.no);
        else if (foiClique && gesto.no.tipo === "nota") selecionar(gesto.no.id);
        gesto = SEM_GESTO;
      } else if (gesto.tipo === "fundo") {
        // Tocar no vazio fecha o cartão da nota selecionada.
        if (!gesto.moveu && foiClique) selecionar(null);
        gesto = SEM_GESTO;
      } else if (gesto.tipo === "pinca") {
        // Sobrou um dedo: continua como arrasto de câmera, sem pulo.
        const [restante] = [...ponteiros.values()];
        gesto = restante
          ? { tipo: "fundo", inicio: restante, cameraInicial: cameraRef.current, moveu: true }
          : SEM_GESTO;
      }
      canvas.style.cursor = "";
    };

    const aoSair = () => {
      hoverRef.current = null;
    };

    const aoRolar = (evento: WheelEvent) => {
      if (!interativoRef.current) return;
      // Sem isto a página inteira rolaria junto com o zoom.
      evento.preventDefault();
      // deltaMode 1 = linhas, 2 = páginas (Firefox, algumas rodas): converte para pixels.
      const unidade = evento.deltaMode === 1 ? 16 : evento.deltaMode === 2 ? 400 : 1;
      const fator = Math.exp(-evento.deltaY * unidade * SENSIBILIDADE_DA_RODA);
      alvoDaCameraRef.current = null;
      cameraRef.current = zoomEmTorno(cameraRef.current, pontoDoEvento(evento), fator, limitesAtuais());
    };

    // Modo fundo: o clique simples abre a nota (no interativo quem trata é o ponteiro).
    const aoClicar = (evento: MouseEvent) => {
      if (interativoRef.current) return;
      const no = noEm(pontoDoEvento(evento), MARGEM_DO_CLIQUE, true);
      if (no) onAbrirNotaRef.current(no.id);
    };

    canvas.addEventListener("pointerdown", aoPressionar);
    canvas.addEventListener("pointermove", aoMover);
    canvas.addEventListener("pointerup", aoSoltar);
    canvas.addEventListener("pointercancel", aoSoltar);
    canvas.addEventListener("pointerleave", aoSair);
    // `passive: false` é o que permite o `preventDefault` acima.
    canvas.addEventListener("wheel", aoRolar, { passive: false });
    canvas.addEventListener("click", aoClicar);

    return () => {
      animando = false;
      cancelAnimationFrame(idDoQuadro);
      observador.disconnect();
      observadorDoTema.disconnect();
      canvas.removeEventListener("pointerdown", aoPressionar);
      canvas.removeEventListener("pointermove", aoMover);
      canvas.removeEventListener("pointerup", aoSoltar);
      canvas.removeEventListener("pointercancel", aoSoltar);
      canvas.removeEventListener("pointerleave", aoSair);
      canvas.removeEventListener("wheel", aoRolar);
      canvas.removeEventListener("click", aoClicar);
      if (gesto.tipo === "no" && gesto.moveu) soltarNo(gesto.no);
      acoesRef.current = ACOES_VAZIAS;
    };
  }, [mapaDeCores, grauPorId, vizinhosPorId, multiplicadorDeTamanho]);

  // Pedido de fora (a barra lateral escolheu uma nota) ou entrada na aba Notas
  // com uma nota já selecionada: a câmera vai até ela. Lê `selecionadoRef`, já
  // atualizado pelo efeito de sincronização acima, que roda antes.
  useEffect(() => {
    const id = selecionadoRef.current;
    if (interativo && id) acoesRef.current.mostrarNota(id);
  }, [interativo, focoPedido]);

  return (
    <div ref={containerRef} className="absolute inset-0 -z-0">
      <canvas
        ref={canvasRef}
        role={interativo ? "img" : undefined}
        aria-label={interativo ? "Grafo de notas conectadas" : undefined}
        aria-hidden={interativo ? undefined : true}
        // `touch-none`: sem isso o navegador roubaria o arrasto e a pinça para rolar/dar zoom na página.
        className={`h-full w-full ${interativo ? "cursor-grab touch-none" : "cursor-pointer"}`}
      />
    </div>
  );
}
