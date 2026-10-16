/**
 * Ligações `[[assim]]` entre notas: achar no texto, resolver para uma nota e
 * reescrever (quando a nota alvo é renomeada).
 *
 * É a fonte de verdade do grafo e dos "links de entrada": nada disso é
 * guardado à parte, tudo sai do texto na hora da leitura. Pura — roda igual no
 * servidor e no cliente.
 */

import { REGEX_DE_ANEXO, juntarCaminho, normalizarTexto, profundidadeDaPasta } from "./caminho-da-nota";
import { mascararCodigo } from "./markdown-da-nota";

/** `[[...]]` sem colchetes nem quebra de linha lá dentro. */
const REGEX_LIGACAO = /\[\[([^[\]\n]+)\]\]/g;

export type Ligacao = {
  /** "Pasta/Título" ou só "Título", sem `.md`, sem seção, bloco ou apelido. */
  alvo: string;
  secao: string | null;
  bloco: string | null;
  apelido: string | null;
  /**
   * O separador do apelido veio escrito `\|`, como o Obsidian faz dentro de tabelas
   * (um `|` puro partiria a coluna). Reescrever precisa devolvê-lo igual.
   */
  barraEscapada: boolean;
  /** O alvo é um arquivo que não é nota (imagem, PDF…). */
  anexo: boolean;
  /** Escrita como `![[...]]`. */
  embutida: boolean;
  /** Posição do `[[` e do fim do `]]` (exclusivo) no texto. A `!` de embutida fica de fora. */
  inicio: number;
  fim: number;
};

type PartesDaLigacao = Pick<Ligacao, "alvo" | "secao" | "bloco" | "apelido"> & { barraEscapada?: boolean };

function interpretar(interno: string): (PartesDaLigacao & { barraEscapada: boolean }) | null {
  const barra = interno.indexOf("|");
  // Dentro de tabelas o Obsidian escreve `[[A\|apelido]]`: a barra invertida pertence ao separador, não ao alvo.
  const barraEscapada = barra > 0 && interno[barra - 1] === "\\";
  const semApelido = barra === -1 ? interno : interno.slice(0, barraEscapada ? barra - 1 : barra);
  const apelido = barra === -1 ? null : interno.slice(barra + 1).trim() || null;

  const partes = semApelido.match(/^([^#^]*)(?:#([^^]*))?(?:\^(.*))?$/);
  if (!partes) return null;

  const alvo = partes[1].trim().replace(/\.md$/i, "");
  if (alvo === "") return null;

  return { alvo, secao: partes[2]?.trim() || null, bloco: partes[3]?.trim() || null, apelido, barraEscapada };
}

/** Todas as ligações do texto, na ordem, fora de blocos e trechos de código. */
export function extrairLigacoes(conteudo: string): Ligacao[] {
  const mascarado = mascararCodigo(conteudo);
  const ligacoes: Ligacao[] = [];

  for (const combinou of mascarado.matchAll(REGEX_LIGACAO)) {
    const partes = interpretar(combinou[1]);
    if (!partes) continue;

    const inicio = combinou.index;
    // `\[[Nota]]`: a barra invertida desliga a ligação, como em Markdown.
    if (inicio > 0 && mascarado[inicio - 1] === "\\") continue;
    ligacoes.push({
      ...partes,
      anexo: REGEX_DE_ANEXO.test(partes.alvo),
      embutida: inicio > 0 && mascarado[inicio - 1] === "!",
      inicio,
      fim: inicio + combinou[0].length,
    });
  }

  return ligacoes;
}

export function formatarLigacao({ alvo, secao, bloco, apelido, barraEscapada }: PartesDaLigacao): string {
  const separador = barraEscapada ? "\\|" : "|";
  return `[[${alvo}${secao ? `#${secao}` : ""}${bloco ? `^${bloco}` : ""}${apelido ? `${separador}${apelido}` : ""}]]`;
}

/** `Pasta/Antigo` + "Novo" -> `Pasta/Novo`: a ligação mantém o caminho de pasta que já tinha. */
export function trocarTituloNoAlvo(alvo: string, novoTitulo: string): string {
  const ultimaBarra = alvo.lastIndexOf("/");
  return ultimaBarra === -1 ? novoTitulo : `${alvo.slice(0, ultimaBarra + 1)}${novoTitulo}`;
}

/**
 * Reescreve o alvo das ligações. `decidir` recebe cada ligação e devolve o
 * novo alvo, ou `null` para deixá-la como está. Seção, bloco, apelido e o `!`
 * de embutida são preservados; código não é tocado.
 */
export function reescreverLigacoes(conteudo: string, decidir: (ligacao: Ligacao) => string | null): string {
  let resultado = "";
  let cursor = 0;

  for (const ligacao of extrairLigacoes(conteudo)) {
    const novoAlvo = decidir(ligacao);
    if (novoAlvo === null) continue;

    resultado += conteudo.slice(cursor, ligacao.inicio) + formatarLigacao({ ...ligacao, alvo: novoAlvo });
    cursor = ligacao.fim;
  }

  return resultado + conteudo.slice(cursor);
}

/** O mínimo que o resolvedor precisa saber de uma nota. */
export type NotaParaResolver = { id: string; titulo: string; pasta: string | null };

export type ResolucaoDeLigacao =
  | { tipo: "resolvida"; nota: NotaParaResolver }
  /** Mais de uma nota com o título: `nota` é a escolhida pelo desempate, `candidatas` são todas (a escolhida primeiro). */
  | { tipo: "ambigua"; nota: NotaParaResolver; candidatas: NotaParaResolver[] }
  | { tipo: "nao-resolvida" };

export type Resolvedor = (alvo: string, pastaDeOrigem: string | null) => ResolucaoDeLigacao;

/** Ordem total: números dentro do texto comparam como números ("9" < "10"), e o que empatar cai na ordem do texto. */
function compararIds(a: string, b: string): number {
  return a.localeCompare(b, "en", { numeric: true }) || (a < b ? -1 : a > b ? 1 : 0);
}

/** Quantos segmentos de pasta duas pastas têm em comum, a partir da raiz. */
function segmentosEmComum(a: string | null, b: string | null): number {
  if (!a || !b) return 0;
  const segmentosB = normalizarTexto(b).split("/");
  let comum = 0;
  for (const [i, segmento] of normalizarTexto(a).split("/").entries()) {
    if (segmentosB[i] !== segmento) break;
    comum++;
  }
  return comum;
}

/**
 * Monta o índice uma vez e devolve a função que resolve cada alvo — resolver
 * 800 notas com milhares de ligações não pode varrer a lista inteira a cada uma.
 *
 * Título repetido desempata, nesta ordem, por: mesma pasta da nota de origem,
 * pasta menos funda, menor id. É determinístico: a mesma ligação resolve para
 * a mesma nota sempre.
 */
export function criarResolvedor(notas: readonly NotaParaResolver[]): Resolvedor {
  const porTitulo = new Map<string, NotaParaResolver[]>();
  const porCaminho = new Map<string, NotaParaResolver[]>();
  const caminhos: { nota: NotaParaResolver; caminho: string }[] = [];

  const guardar = (mapa: Map<string, NotaParaResolver[]>, chave: string, nota: NotaParaResolver) => {
    const lista = mapa.get(chave);
    if (lista) lista.push(nota);
    else mapa.set(chave, [nota]);
  };

  for (const nota of notas) {
    const caminho = normalizarTexto(juntarCaminho(nota.pasta, nota.titulo));
    guardar(porTitulo, normalizarTexto(nota.titulo), nota);
    guardar(porCaminho, caminho, nota);
    caminhos.push({ nota, caminho });
  }

  // A busca pelo final do caminho varre todas as notas; guardar o resultado por alvo evita
  // repeti-la a cada ligação igual (uma nota pode citar o mesmo alvo milhares de vezes).
  const porFinalDeCaminho = new Map<string, NotaParaResolver[]>();
  const buscarPeloFinal = (procurado: string): NotaParaResolver[] => {
    let achadas = porFinalDeCaminho.get(procurado);
    if (!achadas) {
      achadas = caminhos.filter((c) => c.caminho.endsWith(`/${procurado}`)).map((c) => c.nota);
      porFinalDeCaminho.set(procurado, achadas);
    }
    return achadas;
  };

  return (alvo, pastaDeOrigem) => {
    const procurado = normalizarTexto(alvo.replace(/\.md$/i, "").replace(/^\/+/, "").trim());
    if (procurado === "") return { tipo: "nao-resolvida" };

    const candidatas = procurado.includes("/")
      ? (porCaminho.get(procurado) ?? buscarPeloFinal(procurado))
      : (porTitulo.get(procurado) ?? []);

    if (candidatas.length === 0) return { tipo: "nao-resolvida" };
    if (candidatas.length === 1) return { tipo: "resolvida", nota: candidatas[0] };

    // A pasta da própria origem (ou a ancestral dela mais perto) ganha: é a que a pessoa tem "ao lado".
    const ordenadas = [...candidatas].sort(
      (a, b) =>
        segmentosEmComum(pastaDeOrigem, b.pasta) - segmentosEmComum(pastaDeOrigem, a.pasta) ||
        profundidadeDaPasta(a.pasta) - profundidadeDaPasta(b.pasta) ||
        compararIds(a.id, b.id),
    );
    return { tipo: "ambigua", nota: ordenadas[0], candidatas: ordenadas };
  };
}
