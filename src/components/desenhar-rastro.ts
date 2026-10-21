/**
 * O desenho do rastro do agente por cima do grafo: brilho, anéis, ondas do
 * nascimento, o caminho percorrido com a faísca e os rótulos. Tudo em azul — o que
 * muda de um estado para outro é o tamanho, o anel, o brilho e a opacidade.
 * O estado de cada nota vem de `quadroDoRastro` (puro); aqui só se pinta.
 */

import type { Ponto } from "@/lib/camera-do-grafo";
import { comAlfa, misturar } from "@/lib/cores-do-canvas";
import type { LinkSimulado } from "@/lib/simulacao-do-grafo";
import type { NotaNoRastro, QuadroDoRastro } from "@/lib/rastro-do-agente";
import type { Cores, NoVisual } from "./desenhar-grafo";

export type ContextoDoRastro = {
  contexto: CanvasRenderingContext2D;
  largura: number;
  altura: number;
  cores: Cores;
  rastro: QuadroDoRastro;
  /** Milissegundos, no relógio do `requestAnimationFrame` (o mesmo do rastro). */
  agora: number;
  /** Quando cada nó apareceu no layout; ausente = já estava lá antes do rastro. */
  nascimentos: ReadonlyMap<string, number>;
  /** `prefers-reduced-motion`: sem pulsar, girar, ondas nem faísca. */
  reduzido: boolean;
  nosPorId: ReadonlyMap<string, NoVisual>;
  /** Notas que o agente criou nesta conversa: o nascimento delas toca quando o nó aparece no layout. */
  criadas: ReadonlySet<string>;
  /** As ligações reais de cada nó, indexadas uma vez por layout. */
  ligacoesPorNo: ReadonlyMap<string, readonly LinkSimulado[]>;
  /** Posição do nó na tela. */
  posicao: (no: NoVisual) => Ponto;
  raioNaTela: (no: NoVisual) => number;
};

const DOIS_PI = Math.PI * 2;

// --- Nascimento -------------------------------------------------------------

const DURACAO_DO_CRESCIMENTO_MS = 600;
const OVERSHOOT_DO_CRESCIMENTO = 1.2;
const DURACAO_DA_ONDA_MS = 1000;
const ATRASO_ENTRE_ONDAS_MS = 260;
const NUMERO_DE_ONDAS = 2;
const ALCANCE_DA_ONDA = 46;
const DURACAO_DAS_LIGACOES_NOVAS_MS = 700;

// --- Brilho, anéis e traços -----------------------------------------------

const CRESCIMENTO_LENDO = 3;
const CRESCIMENTO_ESCREVENDO = 2;
/** Quanto de azul uma nota "vista" ganha, em relação à candidata. */
const FORCA_DA_VISTA = 0.4;
const LARGURA_DO_ANEL = 1.5;
const PULSO_DO_BRILHO = 0.25;
const VELOCIDADE_DO_PULSO = 5;
const VELOCIDADE_DO_GIRO = 18;
const TRACEJADO = [4, 4];

const LARGURA_DO_CAMINHO = 2;
const OPACIDADE_DO_CAMINHO = 0.9;
const RAIO_DA_FAISCA = 3.5;
const RAIO_DO_BRILHO_DA_FAISCA = 18;
const LARGURA_DO_CONTORNO_DA_FAISCA = 1.5;

type EstiloDeBrilho = { raio: number; forca: number; pulsa?: boolean };
type EstiloDeAnel = { folga: number; opacidade: number; tracejado?: boolean };

const BRILHO_DO_ESTADO: Partial<Record<NotaNoRastro["estado"], EstiloDeBrilho>> = {
  candidata: { raio: 16, forca: 0.35 },
  lendo: { raio: 60, forca: 0.5, pulsa: true },
  escrevendo: { raio: 36, forca: 0.45 },
  nova: { raio: 30, forca: 0.3 },
};

const ANEL_DO_ESTADO: Partial<Record<NotaNoRastro["estado"], EstiloDeAnel>> = {
  lendo: { folga: 5, opacidade: 0.7 },
  lida: { folga: 4, opacidade: 0.5 },
  citada: { folga: 4, opacidade: 0.5 },
  escrevendo: { folga: 5, opacidade: 0.9, tracejado: true },
  nova: { folga: 4, opacidade: 0.55 },
};

// --- Rótulos ----------------------------------------------------------------

const TAMANHO_DO_ROTULO = 12;
const TAMANHO_MAXIMO_DO_TITULO = 28;
const ALTURA_DO_ROTULO = 22;
const PREENCHIMENTO_DO_ROTULO = 9;
const FOLGA_DO_ROTULO_AO_NO = 6;
const MARGEM_DO_ROTULO = 6;
const MAXIMO_DE_ROTULOS_DO_RASTRO = 12;
const SUFIXO_DE_EDICAO = " · editando";
const TEXTO_DA_ETIQUETA = "nova";
const FOLGA_DA_ETIQUETA = 6;
const PREENCHIMENTO_DA_ETIQUETA = 5;
const ALTURA_DA_ETIQUETA = 14;

/** Quem aparece com rótulo, e a ordem de prioridade quando há muitos. */
const PRIORIDADE_DO_ROTULO: Partial<Record<NotaNoRastro["estado"], number>> = {
  escrevendo: 0,
  lendo: 1,
  nova: 2,
  citada: 3,
};

export function abreviar(titulo: string): string {
  return titulo.length > TAMANHO_MAXIMO_DO_TITULO
    ? `${titulo.slice(0, TAMANHO_MAXIMO_DO_TITULO - 1)}…`
    : titulo;
}

function limitar(valor: number): number {
  return Math.min(1, Math.max(0, valor));
}

/** Cresce passando um pouco do tamanho final e assenta. */
function crescerComOvershoot(progresso: number): number {
  const t = limitar(progresso);
  const c3 = OVERSHOOT_DO_CRESCIMENTO + 1;
  return 1 + c3 * (t - 1) ** 3 + OVERSHOOT_DO_CRESCIMENTO * (t - 1) ** 2;
}

/**
 * Há quantos ms a nota nasceu, ou `null` se ela não está nascendo. O nó só existe depois que a
 * lista de notas atualiza: numa nota que o agente criou, o nascimento conta desde que o nó
 * entrou no layout, sem esperar o fim do eco da escrita (`desde` da "nova").
 */
function idadeDoNascimento(id: string, nota: NotaNoRastro, ctx: ContextoDoRastro): number | null {
  const chegada = ctx.nascimentos.get(id);
  if (ctx.criadas.has(id) && chegada !== undefined) return ctx.agora - chegada;
  if (nota.estado !== "nova") return null;
  return ctx.agora - Math.max(nota.desde, chegada ?? -Infinity);
}

/** As ligações da nota acendem em azul enquanto ela é recém-nascida (escrevendo ou nova). */
function estaNascendoComLigacoes(nota: NotaNoRastro): boolean {
  return nota.estado === "nova" || nota.estado === "escrevendo";
}

/** Os links de cada nó, para achar os de uma nota nova sem varrer todos a cada quadro. */
export function indexarLigacoes(
  links: readonly LinkSimulado[],
): ReadonlyMap<string, readonly LinkSimulado[]> {
  const indice = new Map<string, LinkSimulado[]>();
  const registrar = (id: string, link: LinkSimulado) => {
    const lista = indice.get(id);
    if (lista) lista.push(link);
    else indice.set(id, [link]);
  };
  for (const link of links) {
    registrar(link.source.id, link);
    if (link.target.id !== link.source.id) registrar(link.target.id, link);
  }
  return indice;
}

function escalaDoNascimento(idade: number, reduzido: boolean): number {
  return reduzido ? 1 : crescerComOvershoot(idade / DURACAO_DO_CRESCIMENTO_MS);
}

// --- Estilo do nó -----------------------------------------------------------

export type EstiloDoNoNoRastro = { cor: string; raio: number; alfa: number };

/** Cor, raio e opacidade de um nó que está no rastro. */
export function estiloDoNoNoRastro(
  no: NoVisual,
  nota: NotaNoRastro,
  corBase: string,
  raioBase: number,
  ctx: ContextoDoRastro,
): EstiloDoNoNoRastro {
  const estilo = estiloDoEstado(nota, corBase, raioBase, ctx);
  const idade = idadeDoNascimento(no.id, nota, ctx);
  if (idade === null) return estilo;
  // Nascendo: o nó cresce do nada, passando um pouco do tamanho final.
  return { ...estilo, raio: Math.max(0, estilo.raio * escalaDoNascimento(idade, ctx.reduzido)) };
}

function estiloDoEstado(
  nota: NotaNoRastro,
  corBase: string,
  raioBase: number,
  ctx: ContextoDoRastro,
): EstiloDoNoNoRastro {
  const { destaque } = ctx.cores;
  switch (nota.estado) {
    case "candidata":
      return { cor: misturar(corBase, destaque, nota.intensidade), raio: raioBase, alfa: 1 };
    case "vista":
      return {
        cor: misturar(corBase, destaque, FORCA_DA_VISTA * nota.intensidade),
        raio: raioBase,
        alfa: 1,
      };
    case "lendo":
      return { cor: destaque, raio: raioBase + CRESCIMENTO_LENDO, alfa: 1 };
    case "escrevendo":
      return { cor: destaque, raio: raioBase + CRESCIMENTO_ESCREVENDO, alfa: 1 };
    default:
      return { cor: destaque, raio: raioBase, alfa: 1 };
  }
}

function raioDoNoNoRastro(no: NoVisual, nota: NotaNoRastro, ctx: ContextoDoRastro): number {
  return estiloDoNoNoRastro(no, nota, ctx.cores.destaque, ctx.raioNaTela(no), ctx).raio;
}

// --- Passos de desenho ------------------------------------------------------

function brilhar(
  contexto: CanvasRenderingContext2D,
  cor: string,
  { x, y }: Ponto,
  raio: number,
  forca: number,
): void {
  const gradiente = contexto.createRadialGradient(x, y, 0, x, y, raio);
  gradiente.addColorStop(0, comAlfa(cor, forca));
  gradiente.addColorStop(0.45, comAlfa(cor, forca * 0.4));
  gradiente.addColorStop(1, comAlfa(cor, 0));
  contexto.globalAlpha = 1;
  contexto.fillStyle = gradiente;
  contexto.beginPath();
  contexto.arc(x, y, raio, 0, DOIS_PI);
  contexto.fill();
}

function fatorDoPulso(ctx: ContextoDoRastro): number {
  if (ctx.reduzido) return 1;
  return 1 + PULSO_DO_BRILHO * Math.sin((ctx.agora / 1000) * VELOCIDADE_DO_PULSO);
}

/** Brilho suave atrás dos nós do rastro — desenhado antes deles. */
export function desenharBrilhos(ctx: ContextoDoRastro): void {
  for (const [id, nota] of ctx.rastro.notas) {
    const no = ctx.nosPorId.get(id);
    const estilo = BRILHO_DO_ESTADO[nota.estado];
    if (!no || !estilo) continue;
    const intensidade = nota.estado === "candidata" ? nota.intensidade : 1;
    const forca = estilo.forca * intensidade * (estilo.pulsa ? fatorDoPulso(ctx) : 1);
    brilhar(ctx.contexto, ctx.cores.destaqueTexto, ctx.posicao(no), estilo.raio, forca);
  }
}

function tracarCirculo(
  contexto: CanvasRenderingContext2D,
  { x, y }: Ponto,
  raio: number,
  largura: number,
  opacidade: number,
  cor: string,
): void {
  contexto.beginPath();
  contexto.arc(x, y, Math.max(0, raio), 0, DOIS_PI);
  contexto.strokeStyle = cor;
  contexto.lineWidth = largura;
  contexto.globalAlpha = opacidade;
  contexto.stroke();
}

function desenharAnel(ctx: ContextoDoRastro, no: NoVisual, nota: NotaNoRastro): void {
  const estilo = ANEL_DO_ESTADO[nota.estado];
  if (!estilo) return;
  const idade = idadeDoNascimento(no.id, nota, ctx);
  // A nova só ganha o anel quando termina de crescer.
  if (nota.estado === "nova" && !ctx.reduzido && idade !== null && idade < DURACAO_DO_CRESCIMENTO_MS) return;

  const { contexto } = ctx;
  const raio = raioDoNoNoRastro(no, nota, ctx) + estilo.folga;
  if (estilo.tracejado) {
    contexto.setLineDash(TRACEJADO);
    contexto.lineDashOffset = ctx.reduzido ? 0 : -(ctx.agora / 1000) * VELOCIDADE_DO_GIRO;
  }
  tracarCirculo(contexto, ctx.posicao(no), raio, LARGURA_DO_ANEL, estilo.opacidade, ctx.cores.destaque);
  if (estilo.tracejado) {
    contexto.setLineDash([]);
    contexto.lineDashOffset = 0;
  }
}

function desenharOndas(ctx: ContextoDoRastro, no: NoVisual, nota: NotaNoRastro): void {
  if (ctx.reduzido) return;
  const idade = idadeDoNascimento(no.id, nota, ctx);
  if (idade === null) return;
  const centro = ctx.posicao(no);
  const raioBase = ctx.raioNaTela(no);

  for (let i = 0; i < NUMERO_DE_ONDAS; i++) {
    const progresso = (idade - i * ATRASO_ENTRE_ONDAS_MS) / DURACAO_DA_ONDA_MS;
    if (progresso <= 0 || progresso >= 1) continue;
    tracarCirculo(
      ctx.contexto,
      centro,
      raioBase + progresso * ALCANCE_DA_ONDA,
      LARGURA_DO_ANEL * (1 - progresso) + 0.5,
      (1 - progresso) * 0.6,
      ctx.cores.destaque,
    );
  }
}

/** Anéis (e as ondas do nascimento) por cima dos nós. */
export function desenharAneis(ctx: ContextoDoRastro): void {
  for (const [id, nota] of ctx.rastro.notas) {
    const no = ctx.nosPorId.get(id);
    if (!no) continue;
    desenharAnel(ctx, no, nota);
    desenharOndas(ctx, no, nota);
  }
}

/** As ligações reais de cada nota recém-nascida acendem em azul, aos poucos. */
export function desenharLigacoesDasNovas(ctx: ContextoDoRastro): void {
  const { contexto } = ctx;
  for (const [id, nota] of ctx.rastro.notas) {
    if (!estaNascendoComLigacoes(nota) || !ctx.nosPorId.has(id)) continue;
    const idade = idadeDoNascimento(id, nota, ctx);
    if (idade === null) continue;
    const progresso = ctx.reduzido ? 1 : limitar(idade / DURACAO_DAS_LIGACOES_NOVAS_MS);
    const links = ctx.ligacoesPorNo.get(id);
    if (progresso <= 0 || !links) continue;

    contexto.beginPath();
    for (const link of links) {
      const de = ctx.posicao(link.source as NoVisual);
      const para = ctx.posicao(link.target as NoVisual);
      contexto.moveTo(de.x, de.y);
      contexto.lineTo(para.x, para.y);
    }
    contexto.strokeStyle = ctx.cores.destaque;
    contexto.lineWidth = LARGURA_DO_ANEL;
    contexto.globalAlpha = progresso * OPACIDADE_DO_CAMINHO;
    contexto.stroke();
  }
}

// --- Caminho e faísca ---------------------------------------------------------

type Trecho = { pontos: Ponto[]; ponta: Ponto };

/** O pedaço do caminho que já foi percorrido: do início até `progresso` do comprimento total. */
function trechoPercorrido(pontos: readonly Ponto[], progresso: number): Trecho | null {
  if (pontos.length < 2) return null;
  const distancias = pontos.slice(1).map((p, i) => Math.hypot(p.x - pontos[i].x, p.y - pontos[i].y));
  const alvo = distancias.reduce((soma, d) => soma + d, 0) * limitar(progresso);

  const percorrido: Ponto[] = [pontos[0]];
  let acumulado = 0;
  for (let i = 0; i < distancias.length; i++) {
    const resto = alvo - acumulado;
    if (resto >= distancias[i]) {
      percorrido.push(pontos[i + 1]);
      acumulado += distancias[i];
      continue;
    }
    const fracao = distancias[i] === 0 ? 0 : resto / distancias[i];
    percorrido.push({
      x: pontos[i].x + (pontos[i + 1].x - pontos[i].x) * fracao,
      y: pontos[i].y + (pontos[i + 1].y - pontos[i].y) * fracao,
    });
    break;
  }
  return { pontos: percorrido, ponta: percorrido[percorrido.length - 1] };
}

/**
 * Os pedaços do caminho cujos nós estão todos no grafo. Um id que não está (nota fora do
 * teto do grafo) quebra o caminho ali: os vizinhos dele não se ligam por cima do vazio.
 */
function trechosDoCaminho(ids: readonly string[], ctx: ContextoDoRastro): Ponto[][] {
  const trechos: Ponto[][] = [];
  let atual: Ponto[] = [];
  for (const id of ids) {
    const no = ctx.nosPorId.get(id);
    if (no) {
      atual.push(ctx.posicao(no));
      continue;
    }
    if (atual.length > 0) trechos.push(atual);
    atual = [];
  }
  if (atual.length > 0) trechos.push(atual);
  return trechos;
}

/** Linha azul por onde o agente passou, desenhada até onde a faísca chegou. */
export function desenharCaminho(ctx: ContextoDoRastro): Ponto | null {
  const { contexto, rastro } = ctx;
  let ponta: Ponto | null = null;
  if (rastro.segmentos.length === 0) return null;

  contexto.save();
  contexto.strokeStyle = ctx.cores.destaque;
  contexto.lineWidth = LARGURA_DO_CAMINHO;
  contexto.lineJoin = "round";
  contexto.lineCap = "round";
  contexto.globalAlpha = OPACIDADE_DO_CAMINHO;

  for (const segmento of rastro.segmentos) {
    const progresso = ctx.reduzido ? 1 : segmento.progresso;
    if (progresso <= 0) continue;
    for (const pontos of trechosDoCaminho(segmento.ids, ctx)) {
      const trecho = trechoPercorrido(pontos, progresso);
      if (!trecho) continue;
      contexto.beginPath();
      trecho.pontos.forEach((p, i) => (i === 0 ? contexto.moveTo(p.x, p.y) : contexto.lineTo(p.x, p.y)));
      contexto.stroke();
      if (rastro.faisca === segmento) ponta = trecho.ponta;
    }
  }
  contexto.restore();
  return ponta;
}

/** Ponto azul com brilho na ponta do caminho enquanto ele é percorrido. */
export function desenharFaisca(ctx: ContextoDoRastro, ponta: Ponto | null): void {
  if (!ponta || ctx.reduzido) return;
  const { contexto, cores } = ctx;
  brilhar(contexto, cores.destaqueTexto, ponta, RAIO_DO_BRILHO_DA_FAISCA, 0.7);

  contexto.beginPath();
  contexto.arc(ponta.x, ponta.y, RAIO_DA_FAISCA, 0, DOIS_PI);
  contexto.lineWidth = LARGURA_DO_CONTORNO_DA_FAISCA;
  contexto.strokeStyle = cores.fundo;
  contexto.globalAlpha = 1;
  contexto.stroke();
  contexto.fillStyle = cores.destaque;
  contexto.fill();
}

// --- Rótulos ----------------------------------------------------------------

function tracarPilula(
  contexto: CanvasRenderingContext2D,
  x: number,
  y: number,
  largura: number,
  altura: number,
): void {
  const r = altura / 2;
  contexto.beginPath();
  contexto.moveTo(x + r, y);
  contexto.arcTo(x + largura, y, x + largura, y + altura, r);
  contexto.arcTo(x + largura, y + altura, x, y + altura, r);
  contexto.arcTo(x, y + altura, x, y, r);
  contexto.arcTo(x, y, x + largura, y, r);
  contexto.closePath();
}

type Rotulo = { no: NoVisual; texto: string; nova: boolean; prioridade: number };

function rotulosDoRastro(ctx: ContextoDoRastro): Rotulo[] {
  const rotulos: Rotulo[] = [];
  for (const [id, nota] of ctx.rastro.notas) {
    const no = ctx.nosPorId.get(id);
    const prioridade = PRIORIDADE_DO_ROTULO[nota.estado];
    if (!no || no.tipo !== "nota" || prioridade === undefined) continue;
    const sufixo = nota.estado === "escrevendo" ? SUFIXO_DE_EDICAO : "";
    rotulos.push({ no, texto: `${abreviar(no.titulo)}${sufixo}`, nova: nota.estado === "nova", prioridade });
  }
  return rotulos.sort((a, b) => a.prioridade - b.prioridade).slice(0, MAXIMO_DE_ROTULOS_DO_RASTRO);
}

function desenharRotuloDoRastro(ctx: ContextoDoRastro, rotulo: Rotulo): void {
  const { contexto, cores } = ctx;
  const nota = ctx.rastro.notas.get(rotulo.no.id);
  if (!nota) return;
  const centro = ctx.posicao(rotulo.no);
  const raio = raioDoNoNoRastro(rotulo.no, nota, ctx);

  contexto.font = `600 ${TAMANHO_DO_ROTULO}px ${cores.fonte}`;
  const larguraDoTexto = contexto.measureText(rotulo.texto).width;
  const larguraDaEtiqueta = rotulo.nova
    ? contexto.measureText(TEXTO_DA_ETIQUETA).width + PREENCHIMENTO_DA_ETIQUETA * 2
    : 0;
  const largura =
    larguraDoTexto + PREENCHIMENTO_DO_ROTULO * 2 + (rotulo.nova ? larguraDaEtiqueta + FOLGA_DA_ETIQUETA : 0);

  // Dentro do canvas: nos cantos o rótulo não pode sair da tela.
  const x = Math.min(Math.max(centro.x - largura / 2, MARGEM_DO_ROTULO), Math.max(MARGEM_DO_ROTULO, ctx.largura - largura - MARGEM_DO_ROTULO));
  const abaixo = centro.y + raio + FOLGA_DO_ROTULO_AO_NO;
  const acima = centro.y - raio - FOLGA_DO_ROTULO_AO_NO - ALTURA_DO_ROTULO;
  const cabeAbaixo = abaixo + ALTURA_DO_ROTULO + MARGEM_DO_ROTULO <= ctx.altura;
  const y = Math.max(MARGEM_DO_ROTULO, cabeAbaixo ? abaixo : acima);

  tracarPilula(contexto, x, y, largura, ALTURA_DO_ROTULO);
  contexto.globalAlpha = 1;
  contexto.fillStyle = cores.painel;
  contexto.fill();
  contexto.strokeStyle = cores.bordaSuave;
  contexto.lineWidth = 1;
  contexto.stroke();

  contexto.textAlign = "left";
  contexto.textBaseline = "middle";
  contexto.fillStyle = cores.destaqueTexto;
  contexto.fillText(rotulo.texto, x + PREENCHIMENTO_DO_ROTULO, y + ALTURA_DO_ROTULO / 2);

  if (rotulo.nova) {
    const xEtiqueta = x + PREENCHIMENTO_DO_ROTULO + larguraDoTexto + FOLGA_DA_ETIQUETA;
    const yEtiqueta = y + (ALTURA_DO_ROTULO - ALTURA_DA_ETIQUETA) / 2;
    tracarPilula(contexto, xEtiqueta, yEtiqueta, larguraDaEtiqueta, ALTURA_DA_ETIQUETA);
    contexto.fillStyle = cores.destaque;
    contexto.fill();
    contexto.font = `600 ${TAMANHO_DO_ROTULO - 2}px ${cores.fonte}`;
    contexto.fillStyle = cores.sobreDestaque;
    contexto.fillText(
      TEXTO_DA_ETIQUETA,
      xEtiqueta + PREENCHIMENTO_DA_ETIQUETA,
      yEtiqueta + ALTURA_DA_ETIQUETA / 2,
    );
  }
}

/** Rótulos em pílula das notas lidas, editadas, novas e citadas. */
export function desenharRotulosDoRastro(ctx: ContextoDoRastro): void {
  const rotulos = rotulosDoRastro(ctx);
  if (rotulos.length === 0) return;
  // Fonte, alinhamento e linha de base são do rótulo: não vazam para o resto do quadro.
  ctx.contexto.save();
  for (const rotulo of rotulos) desenharRotuloDoRastro(ctx, rotulo);
  ctx.contexto.restore();
}
