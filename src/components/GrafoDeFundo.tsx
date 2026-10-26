"use client";

import { useEffect, useImperativeHandle, useMemo, useRef, type Ref } from "react";
import type { Simulation } from "d3-force";
import {
  ZOOM_MAXIMO,
  arrastar,
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
import { criarQuadroDoRastroMemoizado } from "@/lib/caminho-memoizado";
import {
  aplicarForma,
  atualizarCerebro,
  type EstadoDoCerebro,
} from "@/lib/cerebro-do-layout";
import { criarMapaDeCoresPorGrupo, NUMERO_DE_CORES_DE_GRUPO } from "@/lib/cores-grupo";
import { idsCriadosNoRastro } from "@/lib/criacoes-do-rastro";
import { caixaDosNos, encontrarNoDesenhadoEm } from "@/lib/geometria-dos-nos";
import {
  avancarProgresso,
  fatorDeRaioNoCerebro,
  fatorDeSuavizacao,
  moverNoDesenhado,
} from "@/lib/morfose-do-grafo";
import type { Rastro } from "@/lib/rastro-do-agente";
import { aplicarRealce, type RealceNoGrafo } from "@/lib/realce-no-grafo";
import { ATRIBUTO_DO_TEMA } from "@/lib/tema";
import {
  RAIO_MAXIMO_DO_NO,
  calcularGraus,
  raioDoNo,
  type ConfiguracaoDoGrafo,
} from "@/lib/fisica-do-grafo";
import type { ArestaDoGrafo, NoDoGrafo } from "@/lib/grafo-de-notas";
import type { EstadoDoNeuronio } from "@/lib/wiki/observabilidade-tipos";
import {
  criarSimulacaoDoGrafo,
  montarVizinhos,
  type LinkSimulado,
  type NoSimulado,
} from "@/lib/simulacao-do-grafo";
import {
  desenharQuadro,
  lerCores,
  resolverArestas,
  type ArestaResolvida,
  type Foco,
  type NoVisual,
} from "./desenhar-grafo";
import { ehNeuronio, geometriaDoNeuronio, noVisivel } from "./desenhar-neuronio";
import { indexarLigacoes } from "./desenhar-rastro";

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
  /** Mostra só os neurônios: notas e sinapses somem do desenho e do clique, sem mexer no layout. */
  somenteNeuronios?: boolean;
  /**
   * Com `somenteNeuronios`, só os neurônios desta lista (por id) aparecem e respondem ao clique.
   * `null` ou ausente: todos. Sem `somenteNeuronios`, é ignorado.
   */
  neuroniosVisiveis?: ReadonlySet<string> | null;
  /** Nome do filtro do cérebro em uso: quando muda, a câmera enquadra o que ficou desenhado. */
  chaveDoFiltro?: string;
  estadosWiki?: ReadonlyMap<string, EstadoDoNeuronio>;
  nos: NoDoGrafo[];
  arestas: ArestaDoGrafo[];
  /** Decide forças e tamanho dos nós (hoje, sempre a configuração padrão). */
  configuracao: ConfiguracaoDoGrafo;
  /** Caminho da nota aberta no leitor agora, ou null — destacada no modo fundo. */
  notaAberta: string | null;
  /** Incrementa a cada resposta do agente — dispara um pulso de movimento. */
  pulso: number;
  /**
   * O que o agente fez na conversa atual (timestamps de `performance.now()`, o mesmo relógio
   * do `requestAnimationFrame`). O grafo mostra o caminho dele por cima das notas.
   */
  rastro?: Rastro | null;
  /** Uma nota que o chat pediu para achar ("Fontes"): fica acesa no cérebro por um instante. */
  realce?: RealceNoGrafo | null;
  /**
   * Fração da altura que o modo fundo deixa livre embaixo para a conversa: o cérebro é
   * enquadrado no que sobra em cima. A aba Notas usa a área inteira.
   */
  reservaInferior?: number;
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
  /**
   * Está coberto por outra coisa (uma nota aberta numa aba): o laço segue vivo, mas não
   * simula nem desenha. Ao descobrir de novo, continua de onde parou, sem embaralhar.
   */
  pausado?: boolean;
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

/** Limite do intervalo entre quadros que alimenta a passagem globo ↔ cérebro. */
const DT_MAXIMO_DO_QUADRO_MS = 100;

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

/**
 * Grava no layout atual o cérebro dele. Com `recalcular`, refaz a forma se os nós ou as
 * posições mudaram (é cara); sem, só reaproveita a que já existe — na aba Notas o cérebro
 * não aparece, então o cálculo espera a volta para a aba Bimo.
 */
function sincronizarCerebro(
  nos: NoVisual[],
  atual: EstadoDoCerebro | null,
  nosPorId: ReadonlyMap<string, NoVisual>,
  recalcular: boolean,
): { estado: EstadoDoCerebro | null; arestas: ArestaResolvida[] } {
  if (recalcular) {
    const estado = atualizarCerebro(nos, atual);
    return { estado, arestas: estado ? resolverArestas(estado.forma.arestas, nosPorId) : [] };
  }
  aplicarForma(nos, atual?.forma ?? null);
  return { estado: atual, arestas: atual ? resolverArestas(atual.forma.arestas, nosPorId) : [] };
}

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
  somenteNeuronios = false,
  neuroniosVisiveis = null,
  chaveDoFiltro = "",
  estadosWiki,
  nos,
  arestas,
  configuracao,
  notaAberta,
  pulso,
  rastro = null,
  realce = null,
  reservaInferior = 0,
  onAbrirNota,
  interativo = false,
  pausado = false,
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

  // Globo ↔ cérebro: 0 = globo (aba Notas), 1 = cérebro (aba Bimo). Nasce já no valor certo,
  // para a página não abrir com o grafo se transformando.
  const progressoRef = useRef(interativo ? 0 : 1);
  const cerebroRef = useRef<EstadoDoCerebro | null>(null);
  const arestasDoCerebroRef = useRef<ArestaResolvida[]>([]);
  // Montados uma vez por layout, para o quadro não indexar nada.
  const nosPorIdRef = useRef<ReadonlyMap<string, NoVisual>>(new Map());
  const ligacoesPorNoRef = useRef<ReturnType<typeof indexarLigacoes>>(new Map());
  // Verdadeiro quando globo ↔ cérebro parou: nada se mexe, então o quadro não refaz a conta.
  const morfoseAssentadaRef = useRef(false);
  // Quando cada nó entrou no layout: o nascimento de uma nota nova toca nesse instante.
  const nascimentosRef = useRef<ReadonlyMap<string, number>>(new Map());
  const rastroRef = useRef(rastro);
  const realceRef = useRef(realce);
  const reservaInferiorRef = useRef(reservaInferior);
  const criadasRef = useRef<ReadonlySet<string>>(new Set());
  const quadroDoRastroRef = useRef(criarQuadroDoRastroMemoizado());

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
  const pausadoRef = useRef(pausado);
  const selecionadoRef = useRef(selecionado);
  const notaAbertaRef = useRef(notaAberta);
  const estadosWikiRef = useRef(estadosWiki);
  const somenteNeuroniosRef = useRef(somenteNeuronios);
  const neuroniosVisiveisRef = useRef(neuroniosVisiveis);
  useEffect(() => { somenteNeuroniosRef.current = somenteNeuronios; }, [somenteNeuronios]);
  useEffect(() => { neuroniosVisiveisRef.current = neuroniosVisiveis; }, [neuroniosVisiveis]);
  useEffect(() => { estadosWikiRef.current = estadosWiki; }, [estadosWiki]);

  const mapaDeCores = useMemo(
    () => criarMapaDeCoresPorGrupo(nos.flatMap((n) => (n.tipo === "nota" ? [n.grupo] : []))),
    [nos],
  );
  const grauPorId = useMemo(() => calcularGraus(arestas), [arestas]);
  const vizinhosPorId = useMemo(() => montarVizinhos(arestas), [arestas]);
  const multiplicadorDeTamanho = configuracao.nodeSizeMultiplier;
  const criadas = useMemo(() => idsCriadosNoRastro(rastro), [rastro]);

  useEffect(() => {
    onAbrirNotaRef.current = onAbrirNota;
    onSelecionarRef.current = onSelecionar;
    interativoRef.current = interativo;
    pausadoRef.current = pausado;
    selecionadoRef.current = selecionado;
    notaAbertaRef.current = notaAberta;
    rastroRef.current = rastro;
    realceRef.current = realce;
    reservaInferiorRef.current = reservaInferior;
    criadasRef.current = criadas;
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
      cerebroRef.current = null;
      arestasDoCerebroRef.current = [];
      nosPorIdRef.current = new Map();
      ligacoesPorNoRef.current = new Map();
      nascimentosRef.current = new Map();
      return;
    }

    const anteriores = new Map(nosRef.current.map((no) => [no.id, no]));
    const { nos: nosSimulados, links, simulacao } = criarSimulacaoDoGrafo({
      nos,
      arestas,
      configuracao,
      graus: grauPorId,
      posicoes: anteriores,
      passos: anteriores.size ? (nos.some((no) => !anteriores.has(no.id)) ? 30 : 0) : undefined,
    });

    const agora = performance.now();
    const nascimentosAnteriores = nascimentosRef.current;
    nascimentosRef.current = new Map(
      nosSimulados.flatMap((no): Array<[string, number]> => {
        const antes = nascimentosAnteriores.get(no.id);
        if (antes !== undefined) return [[no.id, antes]];
        // Quem aparece depois do primeiro layout nasce agora. No primeiro, todos "já estavam lá" —
        // menos a nota que o agente acabou de criar (o primeiro nó de um grafo vazio, por exemplo).
        const apareceu = anteriores.size > 0 ? !anteriores.has(no.id) : criadasRef.current.has(no.id);
        return apareceu ? [[no.id, agora]] : [];
      }),
    );

    // A simulação mexe nestes mesmos objetos; a fase da "respiração" e a posição desenhada só entram por cima.
    const nosVisuais: NoVisual[] = nosSimulados.map((no) => {
      const anterior = anteriores.get(no.id);
      return Object.assign(no, {
        fase: anterior?.fase ?? Math.random() * Math.PI * 2,
        frequencia: anterior?.frequencia ?? 0.4 + Math.random() * 0.5,
        dx: anterior?.dx ?? no.x,
        dy: anterior?.dy ?? no.y,
        progresso: anterior?.progresso ?? 0,
        px: anterior?.px ?? no.x,
        py: anterior?.py ?? no.y,
        tx: 0,
        ty: 0,
      });
    });
    nosRef.current = nosVisuais;
    nosPorIdRef.current = new Map(nosVisuais.map((no) => [no.id, no]));
    ligacoesPorNoRef.current = indexarLigacoes(links);

    // O cérebro é calculado a partir das posições do globo — só quando elas mudaram, e só na
    // aba Bimo (na aba Notas ele não aparece; a volta para a Bimo recalcula).
    const cerebro = sincronizarCerebro(
      nosVisuais,
      cerebroRef.current,
      nosPorIdRef.current,
      !interativoRef.current,
    );
    cerebroRef.current = cerebro.estado;
    arestasDoCerebroRef.current = cerebro.arestas;

    // Quem já estava na tela desliza até a vaga nova; quem chega aparece no lugar certo.
    for (const no of nosVisuais) {
      if (anteriores.has(no.id)) continue;
      moverNoDesenhado(no, {
        progressoGeral: progressoRef.current,
        interativo: interativoRef.current,
        fator: 1,
        reduzido: true,
      });
      no.px = no.dx;
      no.py = no.dy;
    }
    morfoseAssentadaRef.current = false;
    linksRef.current = links;
    simulacaoRef.current = simulacao;
    if (!anteriores.size) {
      zoomIniciadoRef.current = false;
      alvoDaCameraRef.current = null;
    }

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
    const raioDe = (no: NoVisual): number => {
      const grau = grauPorId.get(no.id) ?? 0;
      return raioNaTela(
        raioDoNo(grau, multiplicadorDeTamanho) * fatorDeRaioNoCerebro(grau, no.progresso),
        cameraRef.current.k,
      );
    };

    // `prefers-reduced-motion`: a forma muda de uma vez, sem deslizar, respirar, pulsar nem faísca.
    const consultaDeMovimento = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    let movimentoReduzido = consultaDeMovimento?.matches ?? false;
    const aoMudarMovimento = (evento: MediaQueryListEvent) => {
      movimentoReduzido = evento.matches;
    };
    consultaDeMovimento?.addEventListener?.("change", aoMudarMovimento);

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
      // Com um filtro do cérebro, enquadra só o que continua desenhado.
      const visiveis = somenteNeuroniosRef.current
        ? new Set(nosRef.current.filter((no) => noVisivel(no, { somenteNeuronios: true, neuroniosVisiveis: neuroniosVisiveisRef.current })).map((no) => no.id))
        : null;
      const caixa = caixaDosNos(nosRef.current, "desenhada", visiveis ? (no) => visiveis.has(no.id) : undefined);
      if (!caixa) return null;
      const { largura, altura } = tamanho();
      // No modo fundo o cérebro fica em cima e a conversa embaixo: só a parte de cima enquadra.
      const reserva = interativoRef.current ? 0 : Math.min(Math.max(reservaInferiorRef.current, 0), 0.9);
      return enquadrar(caixa, largura, altura * (1 - reserva), {
        margem: RAIO_MAXIMO_DO_NO * multiplicadorDeTamanho * 2,
        ocupacao: MARGEM_DE_ZOOM,
        zoomMaximo: 1,
      });
    };

    const limitesAtuais = () => limitesDeZoom(enquadramentoDoGrafo()?.k ?? 1);

    // Segue o enquadramento do grafo (como no modo fundo) até a câmera passar a ser do usuário:
    // inclui a volta ao globo na aba Notas, em que o grafo ainda está se transformando.
    let seguindoEnquadramento = !interativoRef.current || progressoRef.current > 0;

    const atualizarCamera = () => {
      if (!zoomIniciadoRef.current) {
        const primeiro = enquadramentoDoGrafo();
        if (!primeiro) return;
        cameraRef.current = primeiro;
        zoomIniciadoRef.current = true;
        return;
      }

      const interativoAgora = interativoRef.current;
      if (!interativoAgora) seguindoEnquadramento = true;

      if (seguindoEnquadramento) {
        const enquadramento = enquadramentoDoGrafo();
        if (!enquadramento) return;
        alvoDaCameraRef.current = null;
        cameraRef.current = movimentoReduzido
          ? enquadramento
          : interpolar(cameraRef.current, enquadramento, SUAVIZACAO_DO_ZOOM);
        // Já é globo e a câmera chegou: daqui em diante ela é do usuário.
        if (interativoAgora && progressoRef.current === 0 && quaseIgual(cameraRef.current, enquadramento)) {
          seguindoEnquadramento = false;
        }
        return;
      }

      // Modo interativo: a câmera é do usuário; só anima rumo a um destino que um botão ou uma seleção pediu.
      const alvo = alvoDaCameraRef.current;
      if (!alvo) return;
      cameraRef.current = movimentoReduzido
        ? alvo
        : interpolar(cameraRef.current, alvo, SUAVIZACAO_DA_CAMERA);
      if (quaseIgual(cameraRef.current, alvo)) {
        cameraRef.current = alvo;
        alvoDaCameraRef.current = null;
      }
    };

    const zoomDosBotoes = (fator: number) => {
      seguindoEnquadramento = false;
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
      // O destino é o globo (a aba Notas), mesmo que o grafo ainda esteja virando globo.
      const caixa = caixaDosNos(nosRef.current, "simulacao", (no) => grupo.has(no.id));
      if (!caixa) return;
      seguindoEnquadramento = false;
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
        if (!enquadramento) return;
        seguindoEnquadramento = false;
        alvoDaCameraRef.current = enquadramento;
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

    let interativoNoQuadroAnterior = interativoRef.current;

    /** Anda o progresso globo ↔ cérebro e leva a posição desenhada de cada nó até o alvo. */
    const atualizarMorfose = (dtMs: number) => {
      const interativoAgora = interativoRef.current;
      // Voltou para a aba Bimo: o cérebro é refeito se o globo mudou enquanto o usuário mexia nele.
      if (interativoNoQuadroAnterior && !interativoAgora) {
        const cerebro = sincronizarCerebro(nosRef.current, cerebroRef.current, nosPorIdRef.current, true);
        cerebroRef.current = cerebro.estado;
        arestasDoCerebroRef.current = cerebro.arestas;
        morfoseAssentadaRef.current = false;
      }
      interativoNoQuadroAnterior = interativoAgora;
      if (morfoseAssentadaRef.current && !interativoAgora) return;

      const alvoGeral = interativoAgora ? 0 : 1;
      const progresso = avancarProgresso(progressoRef.current, alvoGeral, dtMs, movimentoReduzido);
      progressoRef.current = progresso;

      const movimento = {
        progressoGeral: progresso,
        interativo: interativoAgora,
        fator: fatorDeSuavizacao(dtMs),
        reduzido: movimentoReduzido,
      };
      let algumMoveu = false;
      for (const no of nosRef.current) {
        if (moverNoDesenhado(no, movimento)) algumMoveu = true;
      }
      morfoseAssentadaRef.current =
        !interativoAgora && progresso === alvoGeral && movimento.fator > 0 && !algumMoveu;
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
    let tempoDoQuadroAnterior: number | null = null;

    const quadro = (tempoMs: number) => {
      if (!animando) return;
      // Um quadro muito longo (aba em segundo plano) não pode pular a transição inteira.
      const dtMs =
        tempoDoQuadroAnterior === null
          ? 0
          : Math.min(tempoMs - tempoDoQuadroAnterior, DT_MAXIMO_DO_QUADRO_MS);
      tempoDoQuadroAnterior = tempoMs;

      // Coberto por uma nota aberta: não há o que simular nem desenhar, só esperar.
      if (pausadoRef.current) {
        idDoQuadro = requestAnimationFrame(quadro);
        return;
      }
      const { largura, altura } = tamanho();

      // Painel escondido (aba trocada, menu aberto no celular) tem tamanho 0: não há o que desenhar.
      if (largura > 0 && altura > 0) {
        avancarFisica();
        atualizarMorfose(dtMs);
        atualizarCamera();
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
          arestasDoCerebro: arestasDoCerebroRef.current,
          nosPorId: nosPorIdRef.current,
          ligacoesPorNo: ligacoesPorNoRef.current,
          criadas: criadasRef.current,
          rastro: aplicarRealce(
            quadroDoRastroRef.current(rastroRef.current, tempoMs, vizinhosPorId),
            realceRef.current,
            tempoMs,
          ),
          nascimentos: nascimentosRef.current,
          movimentoReduzido,
          estadosWiki: estadosWikiRef.current,
          somenteNeuronios: somenteNeuroniosRef.current,
          neuroniosVisiveis: neuroniosVisiveisRef.current,
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

    // Com "só neurônios", o clique segue o desenho: só acerta os neurônios que estão na tela.
    const SO_NOTAS = (no: NoVisual) =>
      no.tipo === "nota" &&
      noVisivel(no, {
        somenteNeuronios: somenteNeuroniosRef.current,
        neuroniosVisiveis: neuroniosVisiveisRef.current,
      });
    // O neurônio é desenhado maior que a bolinha da nota: o clique acerta o anel inteiro.
    const raioDoAcerto = (no: NoVisual): number =>
      ehNeuronio(no) ? geometriaDoNeuronio(raioDe(no)).anel : raioDe(no);

    // Acerta onde o nó foi desenhado no último quadro (a vaga no cérebro, a respiração), não onde a simulação o deixou.
    const noEm = (ponto: Ponto, margem: number, apenasNotas = false): NoVisual | null =>
      encontrarNoDesenhadoEm(
        nosRef.current,
        cameraRef.current,
        ponto,
        raioDoAcerto,
        margem,
        apenasNotas || somenteNeuroniosRef.current ? SO_NOTAS : undefined,
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
      seguindoEnquadramento = false;
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
          deslocamento: { x: no.px - mundo.x, y: no.py - mundo.y },
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
      seguindoEnquadramento = false;
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
      consultaDeMovimento?.removeEventListener?.("change", aoMudarMovimento);
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

  // Trocar o filtro do cérebro leva a câmera ao que sobrou. A chave é o nome do filtro escolhido, não o
  // conteúdo do Set: a consulta de 30 s pode mudar quem está no recorte, e isso não deve tirar a câmera do lugar.
  useEffect(() => {
    acoesRef.current.enquadrar();
  }, [chaveDoFiltro]);

  return (
    <div ref={containerRef} className="absolute inset-0 -z-0">
      <canvas
        ref={canvasRef}
        role={interativo && !pausado ? "img" : undefined}
        aria-label={interativo && !pausado ? "Grafo de notas conectadas" : undefined}
        // Coberto por uma nota aberta, o grafo não existe para leitor de tela: só a nota está ali.
        aria-hidden={interativo && !pausado ? undefined : true}
        // `touch-none`: sem isso o navegador roubaria o arrasto e a pinça para rolar/dar zoom na página.
        className={`h-full w-full ${interativo ? "cursor-grab touch-none" : "cursor-pointer"}`}
      />
    </div>
  );
}
