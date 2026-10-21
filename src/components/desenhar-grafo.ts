/**
 * O desenho do grafo no canvas: linhas, bolinhas e rótulos. Fica fora do
 * `GrafoDeFundo` para o componente cuidar só de física, câmera e gestos.
 *
 * Dois jeitos de desenhar, escolhidos por `interativo`:
 *  - fundo (aba Bimo): as bolinhas "respiram" e um pulso as agita quando o
 *    agente responde — é pano de fundo, nada aqui é para tocar;
 *  - interativo (aba Notas): posições exatas (o clique tem que acertar o que
 *    está na tela), e a nota selecionada destaca ela e as suas ligações.
 */

import type { Camera, Ponto } from "@/lib/camera-do-grafo";
import { misturar } from "@/lib/cores-do-canvas";
import type { ArestaDoCerebro, TipoDeArestaDoCerebro } from "@/lib/forma-do-cerebro";
import { quadroDoRastro, type QuadroDoRastro } from "@/lib/rastro-do-agente";
import type { LinkSimulado, NoSimulado } from "@/lib/simulacao-do-grafo";
import {
  abreviar,
  desenharAneis,
  desenharBrilhos,
  desenharCaminho,
  desenharFaisca,
  desenharLigacoesDasNovas,
  desenharRotulosDoRastro,
  estiloDoNoNoRastro,
  indexarLigacoes,
  type ContextoDoRastro,
} from "./desenhar-rastro";

/**
 * Nó simulado + a fase própria da "respiração", para as bolinhas não oscilarem em sincronia,
 * + o que o desenho precisa saber da passagem globo ↔ cérebro: a posição desenhada
 * (`dx`, `dy`, em coordenadas do mundo, que a simulação não mexe), o progresso do
 * próprio nó (0 = globo, 1 = cérebro) e a vaga dele no cérebro (`cerebroX`, `cerebroY`, `atraso`).
 * `px`, `py` (mundo, com a respiração) e `tx`, `ty` (tela) são onde ele foi desenhado no
 * último quadro — escritos por `desenharQuadro`, e é neles que o clique acerta.
 */
export type NoVisual = NoSimulado & {
  fase: number;
  frequencia: number;
  dx: number;
  dy: number;
  progresso: number;
  cerebroX?: number;
  cerebroY?: number;
  atraso?: number;
  px: number;
  py: number;
  tx: number;
  ty: number;
};

/** Uma aresta do desenho do cérebro já ligada aos nós, para o quadro não procurar por id. */
export type ArestaResolvida = { de: NoVisual; para: NoVisual; tipo: TipoDeArestaDoCerebro };

/** Liga as arestas do cérebro (por id) aos nós; as que apontam para nó ausente ficam de fora. */
export function resolverArestas(
  arestas: readonly ArestaDoCerebro[],
  nosPorId: ReadonlyMap<string, NoVisual>,
): ArestaResolvida[] {
  return arestas.flatMap((aresta) => {
    const de = nosPorId.get(aresta.de);
    const para = nosPorId.get(aresta.para);
    return de && para ? [{ de, para, tipo: aresta.tipo }] : [];
  });
}

/** A nota selecionada e quem está ligado a ela. */
export type Foco = { id: string; vizinhos: ReadonlySet<string> };

export type Cores = {
  linha: string;
  destaque: string;
  naoResolvida: string;
  tag: string;
  texto: string;
  fundo: string;
  fonte: string;
  /** Nós e ligações do cérebro (o desenho da silhueta e dos sulcos). */
  noNeutro: string;
  arestaNeutra: string;
  /** Azul do brilho e do texto azul: mais claro no tema escuro. */
  destaqueTexto: string;
  sobreDestaque: string;
  /** Fundo e borda do rótulo em pílula. */
  painel: string;
  bordaSuave: string;
  /** Uma cor por grupo de pasta, na ordem de `criarMapaDeCoresPorGrupo`. */
  paleta: string[];
};

export type Quadro = {
  largura: number;
  altura: number;
  camera: Camera;
  /** Segundos — alimenta a "respiração". */
  tempo: number;
  /** Multiplicador da respiração: 1 em repouso, maior logo após um pulso. */
  intensidade: number;
  interativo: boolean;
  /** Nota aberta no leitor — destacada no modo fundo. */
  notaAberta: string | null;
  foco: Foco | null;
  /** Nó sob o cursor, para mostrar o título. */
  hover: string | null;
  nos: readonly NoVisual[];
  links: readonly LinkSimulado[];
  cores: Cores;
  corDoNo: (no: NoVisual) => string;
  raioNaTela: (no: NoVisual) => number;
  /** As arestas só de desenho do cérebro (contorno, sulcos, malha), resolvidas uma vez por layout. */
  arestasDoCerebro?: readonly ArestaResolvida[];
  /** Os nós por id e as ligações por nó, montados uma vez por layout; sem eles, o quadro monta. */
  nosPorId?: ReadonlyMap<string, NoVisual>;
  ligacoesPorNo?: ReadonlyMap<string, readonly LinkSimulado[]>;
  /** Notas que o agente criou nesta conversa (o nascimento toca quando o nó entra no layout). */
  criadas?: ReadonlySet<string>;
  /** O que o agente está fazendo, no instante de `tempo`. Sem isto, não há rastro. */
  rastro?: QuadroDoRastro;
  /** Quando cada nó entrou no layout (ms, relógio de `tempo`), para o nascimento tocar na hora certa. */
  nascimentos?: ReadonlyMap<string, number>;
  /** `prefers-reduced-motion`: sem respirar, pulsar, girar nem faísca. */
  movimentoReduzido?: boolean;
};

/** Quanto uma bolinha se afasta da sua posição de repouso, em pixels de tela. */
const AMPLITUDE_BASE = 1;

/** Translúcidas de propósito: centenas de arestas somam brilho e roubam a cena das notas. */
const OPACIDADE_DAS_LINHAS = 0.4;
const OPACIDADE_DAS_LINHAS_FORA_DO_FOCO = 0.1;
const OPACIDADE_DAS_LINHAS_DO_FOCO = 0.85;
const LARGURA_DAS_LINHAS_DO_FOCO = 1.5;
const OPACIDADE_DOS_NOS = 0.75;
/** Links para notas que ainda não existem aparecem apagados, como no Obsidian. */
const OPACIDADE_DAS_NAO_RESOLVIDAS = 0.4;
const OPACIDADE_DOS_NOS_FORA_DO_FOCO = 0.25;

/** Quanto a nota selecionada e a nota aberta crescem, em pixels de tela. */
const CRESCIMENTO_DO_SELECIONADO = 3;
const CRESCIMENTO_DA_ABERTA = 2;
const FOLGA_DO_ANEL = 4;
const OPACIDADE_DO_ANEL = 0.35;

const TAMANHO_DO_ROTULO = 12;
const FOLGA_DO_ROTULO = 13;
const LARGURA_DO_CONTORNO_DO_ROTULO = 3;
/** Uma nota muito conectada teria centenas de rótulos — vira sopa de letrinhas. */
const MAXIMO_DE_ROTULOS_DE_VIZINHOS = 40;

/** O cérebro: contorno e sulcos mais fortes, malha mais discreta; as ligações reais recuam. */
const ESTILO_DAS_ARESTAS_DO_CEREBRO = {
  malha: { largura: 1, opacidade: 0.75 },
  sulco: { largura: 1.2, opacidade: 0.85 },
  contorno: { largura: 1.4, opacidade: 0.95 },
} as const;
const ORDEM_DAS_ARESTAS_DO_CEREBRO = ["malha", "sulco", "contorno"] as const;
/** Quanto das ligações reais sobra num nó totalmente cérebro. */
const RESTO_DAS_LINHAS_NO_CEREBRO = 0.2;
/** Fades por degraus: assim as linhas seguem em poucos caminhos, mesmo no meio da passagem. */
const DEGRAUS_DE_FADE = 6;


/** Lê as cores das variáveis CSS, para o canvas seguir o tema (claro/escuro) sem cor literal. */
export function lerCores(numeroDeCoresDeGrupo: number): Cores {
  const estilo = getComputedStyle(document.documentElement);
  const ler = (nome: string, reserva: string) => estilo.getPropertyValue(nome).trim() || reserva;

  return {
    linha: ler("--borda", "#e7e3d9"),
    destaque: ler("--destaque", "#2574e0"),
    naoResolvida: ler("--texto-suave", "#8b8f94"),
    tag: ler("--grafo-tag", "#5f8f8b"),
    texto: ler("--texto", "#23252b"),
    fundo: ler("--fundo", "#fbfaf8"),
    fonte: ler("--fonte", "system-ui, sans-serif"),
    noNeutro: ler("--no-neutro", "#c9c6bd"),
    arestaNeutra: ler("--aresta-neutra", "#d8d4c9"),
    destaqueTexto: ler("--destaque-texto", "#1e66c4"),
    sobreDestaque: ler("--sobre-destaque", "#ffffff"),
    painel: ler("--painel", "#ffffff"),
    bordaSuave: ler("--destaque-suave-borda", "#cfe0f8"),
    paleta: Array.from({ length: numeroDeCoresDeGrupo }, (_, i) =>
      ler(`--grafo-cor-${i + 1}`, "#6b6b73"),
    ),
  };
}


const SEM_NASCIMENTOS: ReadonlyMap<string, number> = new Map();
const SEM_CRIADAS: ReadonlySet<string> = new Set();
const SEM_LIGACOES: ReadonlyMap<string, readonly LinkSimulado[]> = new Map();
const RASTRO_VAZIO = quadroDoRastro(null, 0);

export function desenharQuadro(contexto: CanvasRenderingContext2D, quadro: Quadro): void {
  contexto.clearRect(0, 0, quadro.largura, quadro.altura);

  const reduzido = quadro.movimentoReduzido ?? false;
  const algumCerebro = posicionarNos(quadro, !quadro.interativo && !reduzido);
  const posicao = (no: NoVisual): Ponto => ({ x: no.tx, y: no.ty });

  const rastro = quadro.rastro ?? RASTRO_VAZIO;
  const nosPorId = quadro.nosPorId ?? new Map(quadro.nos.map((no) => [no.id, no]));
  const ctxRastro: ContextoDoRastro = {
    contexto,
    largura: quadro.largura,
    altura: quadro.altura,
    cores: quadro.cores,
    rastro,
    agora: quadro.tempo * 1000,
    nascimentos: quadro.nascimentos ?? SEM_NASCIMENTOS,
    reduzido,
    nosPorId,
    criadas: quadro.criadas ?? SEM_CRIADAS,
    ligacoesPorNo:
      quadro.ligacoesPorNo ?? (rastro.notas.size > 0 ? indexarLigacoes(quadro.links) : SEM_LIGACOES),
    posicao,
    raioNaTela: quadro.raioNaTela,
  };

  if (algumCerebro) desenharArestasDoCerebro(contexto, quadro, rastro.foco);
  desenharLinhas(contexto, quadro, rastro.foco);
  desenharLigacoesDasNovas(ctxRastro);
  const ponta = desenharCaminho(ctxRastro);
  desenharBrilhos(ctxRastro);
  desenharNos(contexto, quadro, ctxRastro);
  desenharAneis(ctxRastro);
  desenharFaisca(ctxRastro, ponta);
  if (quadro.interativo) desenharRotulos(contexto, quadro);
  desenharRotulosDoRastro(ctxRastro);

  contexto.globalAlpha = 1;
}

/**
 * Grava em cada nó onde ele vai ser desenhado neste quadro (mundo e tela), com a
 * "respiração" somada — em pixels de tela, por isso dividida pela escala: com o grafo
 * muito afastado, ela seria invisível se fosse medida em unidades da simulação.
 * Devolve se algum nó já é, em parte, cérebro.
 */
function posicionarNos(quadro: Quadro, respirar: boolean): boolean {
  const { camera, tempo, intensidade } = quadro;
  const amplitude = (AMPLITUDE_BASE * intensidade) / Math.max(camera.k, 1e-6);
  let algumCerebro = false;

  for (const no of quadro.nos) {
    no.px = respirar ? no.dx + Math.sin(tempo * no.frequencia + no.fase) * amplitude : no.dx;
    no.py = respirar ? no.dy + Math.cos(tempo * no.frequencia * 0.8 + no.fase) * amplitude : no.dy;
    no.tx = no.px * camera.k + camera.x;
    no.ty = no.py * camera.k + camera.y;
    if (no.progresso > 0) algumCerebro = true;
  }
  return algumCerebro;
}

/** Degraus de fade, escritos num buffer que o desenho reaproveita (sem alocar por quadro). */
let degrausEmBuffer = new Uint8Array(0);
const CONTAGEM_POR_TIPO = 3 * (DEGRAUS_DE_FADE + 1);
const contagemDeDegraus = new Int32Array(CONTAGEM_POR_TIPO);
const INDICE_DO_TIPO: Record<TipoDeArestaDoCerebro, number> = { malha: 0, sulco: 1, contorno: 2 };

function bufferDeDegraus(tamanho: number): Uint8Array {
  if (degrausEmBuffer.length < tamanho) degrausEmBuffer = new Uint8Array(tamanho);
  return degrausEmBuffer;
}

function degrau(progresso: number, arredondar: (n: number) => number): number {
  return arredondar(Math.min(1, Math.max(0, progresso)) * DEGRAUS_DE_FADE);
}

// --- Cérebro ----------------------------------------------------------------

/** Contorno, sulcos e malha: só desenho, somem para o globo e aparecem com o progresso das duas pontas. */
function desenharArestasDoCerebro(
  contexto: CanvasRenderingContext2D,
  quadro: Quadro,
  escurecimento: number,
): void {
  const arestas = quadro.arestasDoCerebro;
  if (!arestas?.length) return;

  const niveis = bufferDeDegraus(arestas.length);
  contagemDeDegraus.fill(0);
  for (let i = 0; i < arestas.length; i++) {
    const { de, para, tipo } = arestas[i];
    const nivel = degrau(Math.min(de.progresso, para.progresso), Math.ceil);
    niveis[i] = nivel;
    if (nivel > 0) contagemDeDegraus[INDICE_DO_TIPO[tipo] * (DEGRAUS_DE_FADE + 1) + nivel] += 1;
  }

  ORDEM_DAS_ARESTAS_DO_CEREBRO.forEach((tipo, indiceDoTipo) => {
    const estilo = ESTILO_DAS_ARESTAS_DO_CEREBRO[tipo];
    for (let nivel = 1; nivel <= DEGRAUS_DE_FADE; nivel++) {
      if (contagemDeDegraus[indiceDoTipo * (DEGRAUS_DE_FADE + 1) + nivel] === 0) continue;
      const e = nivel / DEGRAUS_DE_FADE;
      contexto.beginPath();
      for (let i = 0; i < arestas.length; i++) {
        if (niveis[i] !== nivel || INDICE_DO_TIPO[arestas[i].tipo] !== indiceDoTipo) continue;
        contexto.moveTo(arestas[i].de.tx, arestas[i].de.ty);
        contexto.lineTo(arestas[i].para.tx, arestas[i].para.ty);
      }
      contexto.strokeStyle = tipo === "malha" ? quadro.cores.arestaNeutra : quadro.cores.noNeutro;
      contexto.lineWidth = estilo.largura;
      contexto.globalAlpha = estilo.opacidade * e * e * escurecimento;
      contexto.stroke();
    }
  });
}

// --- Ligações reais -----------------------------------------------------------

function ligadoAoFoco(link: LinkSimulado, foco: Foco | null): boolean {
  return foco !== null && (link.source.id === foco.id || link.target.id === foco.id);
}

function tracarLinks(
  contexto: CanvasRenderingContext2D,
  links: readonly LinkSimulado[],
  incluir: (link: LinkSimulado, indice: number) => boolean,
): void {
  // Um caminho só para todas as linhas do mesmo estilo: com centenas de
  // arestas, um `stroke()` por linha pesa bem mais.
  contexto.beginPath();
  for (let i = 0; i < links.length; i++) {
    if (!incluir(links[i], i)) continue;
    const de = links[i].source as NoVisual;
    const para = links[i].target as NoVisual;
    contexto.moveTo(de.tx, de.ty);
    contexto.lineTo(para.tx, para.ty);
  }
  contexto.stroke();
}

function desenharLinhas(contexto: CanvasRenderingContext2D, quadro: Quadro, escurecimento: number): void {
  const { foco, links, cores } = quadro;
  const opacidadeBase = (foco ? OPACIDADE_DAS_LINHAS_FORA_DO_FOCO : OPACIDADE_DAS_LINHAS) * escurecimento;

  // Degrau de "quanto já é cérebro" de cada ligação: o menor entre as duas pontas.
  const degraus = bufferDeDegraus(links.length);
  contagemDeDegraus.fill(0);
  for (let i = 0; i < links.length; i++) {
    const origem = links[i].source as NoVisual;
    const destino = links[i].target as NoVisual;
    degraus[i] = degrau(Math.min(origem.progresso, destino.progresso), Math.round);
    contagemDeDegraus[degraus[i]] += 1;
  }

  contexto.strokeStyle = cores.linha;
  contexto.lineWidth = 1;
  // As ligações reais recuam à medida que o cérebro toma a cena.
  for (let nivel = 0; nivel <= DEGRAUS_DE_FADE; nivel++) {
    if (contagemDeDegraus[nivel] === 0) continue;
    const e = nivel / DEGRAUS_DE_FADE;
    contexto.globalAlpha = opacidadeBase * (1 - (1 - RESTO_DAS_LINHAS_NO_CEREBRO) * e * e);
    tracarLinks(contexto, links, (link, i) => degraus[i] === nivel && !ligadoAoFoco(link, foco));
  }

  if (!foco) return;
  // As ligações da nota selecionada vão por cima, em azul.
  contexto.strokeStyle = cores.destaque;
  contexto.lineWidth = LARGURA_DAS_LINHAS_DO_FOCO;
  contexto.globalAlpha = OPACIDADE_DAS_LINHAS_DO_FOCO;
  tracarLinks(contexto, links, (link) => ligadoAoFoco(link, foco));
}

// --- Nós --------------------------------------------------------------------

function opacidadeDoNo(no: NoVisual, quadro: Quadro, destacado: boolean): number {
  if (destacado) return 1;
  const { foco } = quadro;
  if (foco) {
    return foco.vizinhos.has(no.id) ? 1 : OPACIDADE_DOS_NOS_FORA_DO_FOCO;
  }
  return no.tipo === "nao-resolvida" ? OPACIDADE_DAS_NAO_RESOLVIDAS : OPACIDADE_DOS_NOS;
}

function desenharNos(
  contexto: CanvasRenderingContext2D,
  quadro: Quadro,
  ctxRastro: ContextoDoRastro,
): void {
  const { rastro } = ctxRastro;
  for (const no of quadro.nos) {
    const { tx: x, ty: y } = no;
    const raio = quadro.raioNaTela(no);
    const selecionado = quadro.foco?.id === no.id;
    // No modo fundo, quem está aberto no leitor faz o papel do selecionado.
    const aberta = !quadro.interativo && no.tipo === "nota" && no.id === quadro.notaAberta;
    const destacado = selecionado || aberta;
    const crescimento = selecionado ? CRESCIMENTO_DO_SELECIONADO : aberta ? CRESCIMENTO_DA_ABERTA : 0;

    // A cor da pasta vira o neutro do cérebro conforme o nó assume a forma.
    const corBase = misturar(quadro.corDoNo(no), quadro.cores.noNeutro, no.progresso);
    const notaDoRastro = rastro.notas.get(no.id);
    const doRastro = notaDoRastro
      ? estiloDoNoNoRastro(no, notaDoRastro, corBase, raio, ctxRastro)
      : null;
    // A nota selecionada ou aberta mantém o destaque dela mesmo estando no rastro.
    const estilo = doRastro
      ? destacado
        ? { cor: quadro.cores.destaque, raio: Math.max(doRastro.raio, raio + crescimento), alfa: 1 }
        : doRastro
      : {
          cor: destacado ? quadro.cores.destaque : corBase,
          raio: raio + crescimento,
          // Enquanto o agente trabalha, o que está fora do rastro escurece.
          alfa: opacidadeDoNo(no, quadro, destacado) * rastro.foco,
        };

    contexto.beginPath();
    contexto.arc(x, y, estilo.raio, 0, Math.PI * 2);
    contexto.fillStyle = estilo.cor;
    contexto.globalAlpha = estilo.alfa;
    contexto.fill();

    if (selecionado) {
      contexto.beginPath();
      contexto.arc(x, y, raio + crescimento + FOLGA_DO_ANEL, 0, Math.PI * 2);
      contexto.strokeStyle = quadro.cores.destaque;
      contexto.lineWidth = 1.5;
      contexto.globalAlpha = OPACIDADE_DO_ANEL;
      contexto.stroke();
    }
  }
}

// --- Rótulos ----------------------------------------------------------------

function desenharRotulo(
  contexto: CanvasRenderingContext2D,
  quadro: Quadro,
  no: NoVisual,
  destaque: boolean,
): void {
  const { tx: x, ty: y } = no;
  const texto = abreviar(no.titulo);
  const baseY = y + quadro.raioNaTela(no) + FOLGA_DO_ROTULO;

  contexto.font = `${destaque ? 600 : 400} ${TAMANHO_DO_ROTULO}px ${quadro.cores.fonte}`;
  contexto.textAlign = "center";
  contexto.globalAlpha = 1;
  // Um contorno da cor do fundo mantém o texto legível por cima de linhas e bolinhas.
  contexto.lineJoin = "round";
  contexto.lineWidth = LARGURA_DO_CONTORNO_DO_ROTULO;
  contexto.strokeStyle = quadro.cores.fundo;
  contexto.strokeText(texto, x, baseY);
  contexto.fillStyle = destaque ? quadro.cores.destaque : quadro.cores.texto;
  contexto.fillText(texto, x, baseY);
}

function desenharRotulos(contexto: CanvasRenderingContext2D, quadro: Quadro): void {
  const { foco, hover, nos } = quadro;
  let vizinhosRotulados = 0;

  for (const no of nos) {
    if (foco?.id === no.id) {
      desenharRotulo(contexto, quadro, no, true);
    } else if (foco?.vizinhos.has(no.id) && vizinhosRotulados < MAXIMO_DE_ROTULOS_DE_VIZINHOS) {
      vizinhosRotulados += 1;
      desenharRotulo(contexto, quadro, no, false);
    } else if (hover === no.id) {
      desenharRotulo(contexto, quadro, no, false);
    }
  }
}
