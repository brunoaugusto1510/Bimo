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

import { mundoParaTela, type Camera, type Ponto } from "@/lib/camera-do-grafo";
import type { LinkSimulado, NoSimulado } from "@/lib/simulacao-do-grafo";

/** Nó simulado + a fase própria da "respiração", para as bolinhas não oscilarem em sincronia. */
export type NoVisual = NoSimulado & { fase: number; frequencia: number };

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
const TAMANHO_MAXIMO_DO_TITULO = 28;
const FOLGA_DO_ROTULO = 13;
const LARGURA_DO_CONTORNO_DO_ROTULO = 3;
/** Uma nota muito conectada teria centenas de rótulos — vira sopa de letrinhas. */
const MAXIMO_DE_ROTULOS_DE_VIZINHOS = 40;

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
    paleta: Array.from({ length: numeroDeCoresDeGrupo }, (_, i) =>
      ler(`--grafo-cor-${i + 1}`, "#6b6b73"),
    ),
  };
}

export function desenharQuadro(contexto: CanvasRenderingContext2D, quadro: Quadro): void {
  contexto.clearRect(0, 0, quadro.largura, quadro.altura);

  const posicao = (no: NoVisual): Ponto =>
    mundoParaTela(quadro.camera, quadro.interativo ? no : comRespiracao(no, quadro));

  desenharLinhas(contexto, quadro, posicao);
  desenharNos(contexto, quadro, posicao);
  if (quadro.interativo) desenharRotulos(contexto, quadro, posicao);

  contexto.globalAlpha = 1;
}

/**
 * Posição com a "respiração" somada. A oscilação é em pixels de tela, por
 * isso é dividida pela escala: com o grafo muito afastado, ela seria
 * invisível se fosse medida em unidades da simulação.
 */
function comRespiracao(no: NoVisual, { tempo, intensidade, camera }: Quadro): Ponto {
  const amplitude = (AMPLITUDE_BASE * intensidade) / Math.max(camera.k, 1e-6);
  return {
    x: no.x + Math.sin(tempo * no.frequencia + no.fase) * amplitude,
    y: no.y + Math.cos(tempo * no.frequencia * 0.8 + no.fase) * amplitude,
  };
}

type Posicao = (no: NoVisual) => Ponto;

function ligadoAoFoco(link: LinkSimulado, foco: Foco | null): boolean {
  return foco !== null && (link.source.id === foco.id || link.target.id === foco.id);
}

function tracarLinks(
  contexto: CanvasRenderingContext2D,
  links: readonly LinkSimulado[],
  posicao: Posicao,
  incluir: (link: LinkSimulado) => boolean,
): void {
  // Um caminho só para todas as linhas do mesmo estilo: com centenas de
  // arestas, um `stroke()` por linha pesa bem mais.
  contexto.beginPath();
  for (const link of links) {
    if (!incluir(link)) continue;
    const de = posicao(link.source as NoVisual);
    const para = posicao(link.target as NoVisual);
    contexto.moveTo(de.x, de.y);
    contexto.lineTo(para.x, para.y);
  }
  contexto.stroke();
}

function desenharLinhas(contexto: CanvasRenderingContext2D, quadro: Quadro, posicao: Posicao): void {
  const { foco, links, cores } = quadro;

  contexto.strokeStyle = cores.linha;
  contexto.lineWidth = 1;
  contexto.globalAlpha = foco ? OPACIDADE_DAS_LINHAS_FORA_DO_FOCO : OPACIDADE_DAS_LINHAS;
  tracarLinks(contexto, links, posicao, (link) => !ligadoAoFoco(link, foco));

  if (!foco) return;
  // As ligações da nota selecionada vão por cima, em azul.
  contexto.strokeStyle = cores.destaque;
  contexto.lineWidth = LARGURA_DAS_LINHAS_DO_FOCO;
  contexto.globalAlpha = OPACIDADE_DAS_LINHAS_DO_FOCO;
  tracarLinks(contexto, links, posicao, (link) => ligadoAoFoco(link, foco));
}

function opacidadeDoNo(no: NoVisual, quadro: Quadro, destacado: boolean): number {
  if (destacado) return 1;
  const { foco } = quadro;
  if (foco) {
    return foco.vizinhos.has(no.id) ? 1 : OPACIDADE_DOS_NOS_FORA_DO_FOCO;
  }
  return no.tipo === "nao-resolvida" ? OPACIDADE_DAS_NAO_RESOLVIDAS : OPACIDADE_DOS_NOS;
}

function desenharNos(contexto: CanvasRenderingContext2D, quadro: Quadro, posicao: Posicao): void {
  for (const no of quadro.nos) {
    const { x, y } = posicao(no);
    const raio = quadro.raioNaTela(no);
    const selecionado = quadro.foco?.id === no.id;
    // No modo fundo, quem está aberto no leitor faz o papel do selecionado.
    const aberta = !quadro.interativo && no.tipo === "nota" && no.id === quadro.notaAberta;
    const destacado = selecionado || aberta;
    const crescimento = selecionado ? CRESCIMENTO_DO_SELECIONADO : aberta ? CRESCIMENTO_DA_ABERTA : 0;

    contexto.beginPath();
    contexto.arc(x, y, raio + crescimento, 0, Math.PI * 2);
    contexto.fillStyle = destacado ? quadro.cores.destaque : quadro.corDoNo(no);
    contexto.globalAlpha = opacidadeDoNo(no, quadro, destacado);
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

function abreviar(titulo: string): string {
  return titulo.length > TAMANHO_MAXIMO_DO_TITULO
    ? `${titulo.slice(0, TAMANHO_MAXIMO_DO_TITULO - 1)}…`
    : titulo;
}

function desenharRotulo(
  contexto: CanvasRenderingContext2D,
  quadro: Quadro,
  no: NoVisual,
  posicao: Posicao,
  destaque: boolean,
): void {
  const { x, y } = posicao(no);
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

function desenharRotulos(contexto: CanvasRenderingContext2D, quadro: Quadro, posicao: Posicao): void {
  const { foco, hover, nos } = quadro;
  let vizinhosRotulados = 0;

  for (const no of nos) {
    if (foco?.id === no.id) {
      desenharRotulo(contexto, quadro, no, posicao, true);
    } else if (foco?.vizinhos.has(no.id) && vizinhosRotulados < MAXIMO_DE_ROTULOS_DE_VIZINHOS) {
      vizinhosRotulados += 1;
      desenharRotulo(contexto, quadro, no, posicao, false);
    } else if (hover === no.id) {
      desenharRotulo(contexto, quadro, no, posicao, false);
    }
  }
}
