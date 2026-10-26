/**
 * O desenho do neurônio (nota escrita pelo Bimo) no canvas: halo azul-claro, anel no painel
 * com traço azul e um núcleo — maior que a bolinha de uma nota. Cada estado do backend muda a
 * forma, não só a cor (daltonismo, tema escuro): tracejado, metade colorida, cinza, pausa.
 * Também o tempo do nascimento: as sinapses crescem uma depois da outra, e o núcleo surge no fim.
 *
 * Tudo em proporção do raio na tela, para seguir o zoom; as cores vêm de `Cores`, lidas do CSS.
 */

import type { LinkSimulado } from "@/lib/simulacao-do-grafo";
import type { EstadoDoNeuronio } from "@/lib/wiki/observabilidade-tipos";
import type { Cores, NoVisual, Quadro } from "./desenhar-grafo";

/** Proporções do desenho (anel de 8 px, halo de 22, núcleo de 3,2, traço de 2,5), relativas ao anel. */
const PROPORCAO = {
  /** O anel, do raio da bolinha de uma nota (8 px contra 4,5). */
  anel: 1.75,
  /** O selecionado (ou aberto no leitor) cresce: anel de 11 px contra 8, halo de 38. */
  anelDestacado: 1.375,
  halo: 2.6,
  haloDestacado: 3.45,
  nucleo: 0.4,
  traco: 0.31,
  /** O sinal de seleção, entre o anel e o halo. */
  selecao: 1.55,
  /** Recém-nascido: um anel tracejado por fora do halo. */
  nascimento: 3.8,
  /** Enquanto as sinapses crescem, só um esboço marca onde o neurônio vai nascer. */
  esboco: 1.6,
  /** "Seu": o ponto azul que sobra, no alto à direita. */
  pontoSeu: 0.33,
  deslocamentoDoPontoSeu: 1.17,
  nucleoSemRaizes: 0.33,
  tracoSemRaizes: 0.83,
  barraDePausa: { largura: 0.25, altura: 0.83, afastamento: 0.29 },
} as const;

const OPACIDADE = {
  selecao: 0.5,
  nascimento: 0.2,
  haloTracejado: 0.35,
  nucleoSemRaizes: 0.6,
  anelEmPausa: 0.5,
  barrasDePausa: 0.7,
  esboco: 0.25,
} as const;

const TRACEJADO = {
  anel: [4, 3],
  halo: [4, 5],
  semRaizes: [3, 4],
  nascimento: [2, 5],
  esboco: [2, 4],
};

const TRACO_MINIMO = 1;
const TRACO_MAXIMO = 3;
/** Reconsolidando: o arco firme no halo vai de −32° a 0°. */
const INICIO_DO_ARCO_DE_RECONSOLIDACAO = -0.56;
const RECEM_NASCIDO_MS = 86_400_000;
/** Cada sinapse cresce em 600 ms (ease-out), uma depois da outra; o núcleo surge em 200 ms no fim. */
const DURACAO_DA_SINAPSE_MS = 600;
const DURACAO_DO_NUCLEO_MS = 200;
/** O núcleo surge de 20% do tamanho. */
const ESCALA_INICIAL_DO_NASCIMENTO = 0.2;
const VOLTA = Math.PI * 2;

/** Uma nota escrita pelo Bimo. */
export function ehNeuronio(no: NoVisual): boolean {
  return no.tipo === "nota" && no.neuronio === true;
}

/**
 * Se o nó entra no desenho (e no clique): com "só neurônios", fica só quem é neurônio — e,
 * havendo `neuroniosVisiveis`, só os da lista. Sem o filtro, todos.
 */
export function noVisivel(
  no: NoVisual,
  filtro: Pick<Quadro, "somenteNeuronios" | "neuroniosVisiveis">,
): boolean {
  if (!filtro.somenteNeuronios) return true;
  if (!ehNeuronio(no)) return false;
  return !filtro.neuroniosVisiveis || filtro.neuroniosVisiveis.has(no.id);
}

export type GeometriaDoNeuronio = { anel: number; halo: number; nucleo: number; traco: number };

/** Os raios do neurônio na tela, a partir do raio que a bolinha de uma nota teria. */
export function geometriaDoNeuronio(raio: number, destacado = false): GeometriaDoNeuronio {
  const anel = raio * PROPORCAO.anel * (destacado ? PROPORCAO.anelDestacado : 1);
  return {
    anel,
    halo: anel * (destacado ? PROPORCAO.haloDestacado : PROPORCAO.halo),
    nucleo: anel * PROPORCAO.nucleo,
    traco: Math.min(TRACO_MAXIMO, Math.max(TRACO_MINIMO, anel * PROPORCAO.traco)),
  };
}

function limitar01(valor: number): number {
  return Math.min(1, Math.max(0, valor));
}

// --- Nascimento ---------------------------------------------------------------

/**
 * Quanto da sinapse de um neurônio recém-nascido já cresceu (0..1, ease-out): elas saem das
 * notas rumo ao neurônio, uma depois da outra. Com movimento reduzido, já nascem prontas.
 */
export function crescimentoDaSinapse(link: LinkSimulado, quadro: Quadro): number {
  if (link.tipo !== "sinapse" || quadro.movimentoReduzido) return 1;
  const de = link.source as NoVisual;
  const para = link.target as NoVisual;
  const neuronio = ehNeuronio(de) ? de : ehNeuronio(para) ? para : null;
  const nasceu = neuronio ? quadro.nascimentos?.get(neuronio.id) : undefined;
  if (!neuronio || nasceu === undefined) return 1;
  const idade = quadro.tempo * 1000 - nasceu;
  const ligacoes = quadro.ligacoesPorNo?.get(neuronio.id) ?? [];
  // Já passou o tempo de todas: pronto, sem procurar a vez desta (o caso de quase todo quadro).
  if (idade >= ligacoes.length * DURACAO_DA_SINAPSE_MS) return 1;
  const ordem = Math.max(0, ligacoes.filter((l) => l.tipo === "sinapse").indexOf(link));
  const progresso = limitar01((idade - ordem * DURACAO_DA_SINAPSE_MS) / DURACAO_DA_SINAPSE_MS);
  return 1 - (1 - progresso) ** 3;
}

/** 0..1: o núcleo surgindo depois que todas as sinapses cresceram. 1 = pronto. */
function progressoDoNucleo(no: NoVisual, quadro: Quadro): number {
  const nasceu = quadro.nascimentos?.get(no.id);
  if (nasceu === undefined || quadro.movimentoReduzido) return 1;
  const idade = quadro.tempo * 1000 - nasceu;
  const ligacoes = quadro.ligacoesPorNo?.get(no.id) ?? [];
  if (idade >= ligacoes.length * DURACAO_DA_SINAPSE_MS + DURACAO_DO_NUCLEO_MS) return 1;
  const sinapses = ligacoes.filter((l) => l.tipo === "sinapse").length;
  return limitar01((idade - sinapses * DURACAO_DA_SINAPSE_MS) / DURACAO_DO_NUCLEO_MS);
}

function recemNascido(no: NoVisual): boolean {
  if (no.tipo !== "nota" || !no.nascidoEm) return false;
  return Date.now() - Date.parse(no.nascidoEm) < RECEM_NASCIDO_MS;
}

// --- Desenho ------------------------------------------------------------------

/** Tudo o que os dois passes do neurônio (halo e corpo) precisam, calculado uma vez por quadro. */
export type DesenhoDoNeuronio = {
  x: number;
  y: number;
  estado: EstadoDoNeuronio;
  /** Já na escala do nascimento. */
  geometria: GeometriaDoNeuronio;
  alfa: number;
  /** Raio do esboço tracejado enquanto as sinapses crescem; 0 quando o neurônio já nasceu. */
  esboco: number;
  recemNascido: boolean;
  selecionado: boolean;
};

/**
 * Monta o desenho do neurônio. `raio` é o da bolinha que ele teria (já com o crescimento do
 * rastro do agente); `alfa`, a opacidade que a cena dá a ele.
 */
export function desenhoDoNeuronio(
  no: NoVisual,
  quadro: Quadro,
  medidas: { raio: number; alfa: number; destacado: boolean; selecionado: boolean },
): DesenhoDoNeuronio {
  const final = geometriaDoNeuronio(medidas.raio, medidas.destacado);
  const nucleo = progressoDoNucleo(no, quadro);
  const escala = ESCALA_INICIAL_DO_NASCIMENTO + (1 - ESCALA_INICIAL_DO_NASCIMENTO) * nucleo;
  return {
    x: no.tx,
    y: no.ty,
    estado: quadro.estadosWiki?.get(no.id) ?? "vivo",
    geometria: {
      anel: final.anel * escala,
      halo: final.halo * escala,
      nucleo: final.nucleo * escala,
      traco: final.traco * escala,
    },
    alfa: medidas.alfa,
    esboco: nucleo <= 0 ? final.anel * PROPORCAO.esboco : 0,
    recemNascido: recemNascido(no),
    selecionado: medidas.selecionado,
  };
}

function circulo(
  contexto: CanvasRenderingContext2D,
  x: number,
  y: number,
  raio: number,
  inicio = 0,
  fim = VOLTA,
): void {
  contexto.beginPath();
  contexto.arc(x, y, Math.max(0, raio), inicio, fim);
}

type Traco = { cor: string; largura: number; alfa: number; tracejado?: number[] };

function tracarCirculo(
  contexto: CanvasRenderingContext2D,
  d: DesenhoDoNeuronio,
  raio: number,
  traco: Traco,
): void {
  circulo(contexto, d.x, d.y, raio);
  contexto.strokeStyle = traco.cor;
  contexto.lineWidth = traco.largura;
  contexto.setLineDash(traco.tracejado ?? []);
  contexto.globalAlpha = traco.alfa;
  contexto.stroke();
  contexto.setLineDash([]);
}

function preencherCirculo(
  contexto: CanvasRenderingContext2D,
  centro: { x: number; y: number },
  raio: number,
  cor: string,
  alfa: number,
): void {
  circulo(contexto, centro.x, centro.y, raio);
  contexto.fillStyle = cor;
  contexto.globalAlpha = alfa;
  contexto.fill();
}

/**
 * O que fica por baixo das bolinhas: o halo (vivo e em tensão), o halo tracejado de quem está
 * reconsolidando, o anel de recém-nascido — ou, enquanto as sinapses crescem, só o esboço.
 * "Seu", sem raízes e em pausa não têm halo: não são o Bimo falando agora.
 */
export function desenharHaloDoNeuronio(
  contexto: CanvasRenderingContext2D,
  cores: Cores,
  d: DesenhoDoNeuronio,
): void {
  const { geometria: g, alfa, estado } = d;
  if (d.esboco > 0) {
    tracarCirculo(contexto, d, d.esboco, {
      cor: cores.destaque,
      largura: 1,
      alfa: alfa * OPACIDADE.esboco,
      tracejado: TRACEJADO.esboco,
    });
    return;
  }
  if (estado !== "vivo" && estado !== "em_tensao" && estado !== "reconsolidando") return;

  if (d.recemNascido) {
    // Brilha mais forte nas primeiras 24 horas, para a pessoa notar.
    tracarCirculo(contexto, d, g.anel * PROPORCAO.nascimento, {
      cor: cores.destaque,
      largura: 1.5,
      alfa: alfa * OPACIDADE.nascimento,
      tracejado: TRACEJADO.nascimento,
    });
  }
  if (estado !== "reconsolidando") {
    preencherCirculo(contexto, d, g.halo, cores.destaqueSuave, alfa);
    return;
  }
  // Reconsolidando: o halo vira um contorno tracejado, com um arco firme marcando a revisão.
  tracarCirculo(contexto, d, g.halo, {
    cor: cores.destaque,
    largura: (g.traco * 2) / 3,
    alfa: alfa * OPACIDADE.haloTracejado,
    tracejado: TRACEJADO.halo,
  });
  circulo(contexto, d.x, d.y, g.halo, INICIO_DO_ARCO_DE_RECONSOLIDACAO, 0);
  contexto.strokeStyle = cores.destaque;
  contexto.lineWidth = g.traco;
  contexto.lineCap = "round";
  contexto.globalAlpha = alfa;
  contexto.stroke();
  contexto.lineCap = "butt";
}

/** O anel no painel, com o traço na cor e no tracejado dados. */
function desenharAnel(
  contexto: CanvasRenderingContext2D,
  cores: Cores,
  d: DesenhoDoNeuronio,
  cor: string,
  opcoes: { tracejado?: number[]; alfaDoTraco?: number } = {},
): void {
  preencherCirculo(contexto, d, d.geometria.anel, cores.painel, d.alfa);
  tracarCirculo(contexto, d, d.geometria.anel, {
    cor,
    largura: d.geometria.traco,
    alfa: d.alfa * (opcoes.alfaDoTraco ?? 1),
    tracejado: opcoes.tracejado,
  });
}

function desenharBarrasDePausa(
  contexto: CanvasRenderingContext2D,
  cores: Cores,
  d: DesenhoDoNeuronio,
): void {
  const { anel } = d.geometria;
  const largura = anel * PROPORCAO.barraDePausa.largura;
  const altura = anel * PROPORCAO.barraDePausa.altura;
  const afastamento = anel * PROPORCAO.barraDePausa.afastamento;
  contexto.beginPath();
  contexto.rect(d.x - afastamento - largura / 2, d.y - altura / 2, largura, altura);
  contexto.rect(d.x + afastamento - largura / 2, d.y - altura / 2, largura, altura);
  contexto.fillStyle = cores.destaqueTexto;
  contexto.globalAlpha = d.alfa * OPACIDADE.barrasDePausa;
  contexto.fill();
}

/** "Seu": editado pela pessoa, agora é dela. Perde o azul; sobra um ponto, de onde ele veio. */
function desenharNeuronioSeu(
  contexto: CanvasRenderingContext2D,
  cores: Cores,
  d: DesenhoDoNeuronio,
): void {
  const { geometria: g } = d;
  desenharAnel(contexto, cores, d, cores.texto);
  preencherCirculo(contexto, d, g.nucleo, cores.texto, d.alfa);
  const deslocamento = g.anel * PROPORCAO.deslocamentoDoPontoSeu;
  const ponto = { x: d.x + deslocamento, y: d.y - deslocamento };
  preencherCirculo(contexto, ponto, g.anel * PROPORCAO.pontoSeu, cores.destaqueTexto, d.alfa);
}

/** Sem raízes: as origens sumiram. Cinza, tracejado e vazado, sem nada de azul. */
function desenharNeuronioSemRaizes(
  contexto: CanvasRenderingContext2D,
  cores: Cores,
  d: DesenhoDoNeuronio,
): void {
  const { geometria: g } = d;
  tracarCirculo(contexto, d, g.anel, {
    cor: cores.textoSuave,
    largura: g.traco * PROPORCAO.tracoSemRaizes,
    alfa: d.alfa,
    tracejado: TRACEJADO.semRaizes,
  });
  const nucleo = g.anel * PROPORCAO.nucleoSemRaizes;
  preencherCirculo(contexto, d, nucleo, cores.textoSuave, d.alfa * OPACIDADE.nucleoSemRaizes);
}

/**
 * Anel e núcleo, por cima das notas. O núcleo usa o azul do brilho (`destaqueTexto`), que o
 * tema escuro clareia, como no desenho; o traço do anel fica no azul de ação.
 */
export function desenharCorpoDoNeuronio(
  contexto: CanvasRenderingContext2D,
  cores: Cores,
  d: DesenhoDoNeuronio,
): void {
  if (d.esboco > 0) return;
  const { geometria: g, alfa } = d;
  switch (d.estado) {
    case "seu":
      desenharNeuronioSeu(contexto, cores, d);
      break;
    case "sem_raizes":
      desenharNeuronioSemRaizes(contexto, cores, d);
      break;
    case "em_pausa":
      // Parou (sem energia, revisão ou erro): o anel esmaece e o núcleo vira pausa.
      desenharAnel(contexto, cores, d, cores.destaque, { alfaDoTraco: OPACIDADE.anelEmPausa });
      desenharBarrasDePausa(contexto, cores, d);
      break;
    case "reconsolidando":
      desenharAnel(contexto, cores, d, cores.destaque, { tracejado: TRACEJADO.anel });
      preencherCirculo(contexto, d, g.nucleo, cores.destaqueTexto, alfa);
      break;
    case "em_tensao":
      desenharAnel(contexto, cores, d, cores.destaque);
      // A metade direita na cor da tensão: as notas de origem dizem coisas diferentes.
      circulo(contexto, d.x, d.y, g.anel, -Math.PI / 2, Math.PI / 2);
      contexto.closePath();
      contexto.fillStyle = cores.tensao;
      contexto.globalAlpha = alfa;
      contexto.fill();
      preencherCirculo(contexto, d, g.nucleo, cores.destaqueTexto, alfa);
      break;
    default:
      desenharAnel(contexto, cores, d, cores.destaque);
      preencherCirculo(contexto, d, g.nucleo, cores.destaqueTexto, alfa);
  }

  if (d.selecionado) {
    tracarCirculo(contexto, d, g.anel * PROPORCAO.selecao, {
      cor: cores.destaqueTexto,
      largura: 1.5,
      alfa: OPACIDADE.selecao,
    });
  }
}
