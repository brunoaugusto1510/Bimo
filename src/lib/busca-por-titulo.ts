/**
 * A busca da paleta "Ir para nota": roda no navegador, sobre a lista de notas
 * que já está na tela, então responde a cada tecla sem rede.
 *
 * Cada palavra da consulta precisa casar com o título (ou com "Pasta/Título").
 * A nota ganha pontos pelo *pior* acerto entre as palavras: título igual >
 * começa com a palavra > começa uma palavra do título > aparece no meio >
 * letras salteadas, na ordem. Em empate, as notas abertas há pouco vêm antes.
 */

import { juntarCaminho, normalizarTexto } from "./caminho-da-nota";
import type { IdDeNota } from "./types";

export type NotaParaBusca = { id: IdDeNota; titulo: string; pasta: string | null };

/** Posições `[início, fim)` no título original, para destacar. */
export type Intervalo = [number, number];

export type ResultadoDaBusca = { nota: NotaParaBusca; pontos: number; intervalos: Intervalo[] };

export const LIMITE_PADRAO_DE_RESULTADOS = 50;

const PONTOS = { igual: 1000, comeco: 800, inicioDePalavra: 600, meio: 400, salteado: 200 } as const;

type TextoNormalizado = {
  normalizado: string;
  /** Para cada letra do texto normalizado, onde começa e onde termina a letra *inteira* no original. */
  inicios: number[];
  fins: number[];
};

const segmentador = new Intl.Segmenter(undefined, { granularity: "grapheme" });
const colador = new Intl.Collator("pt-BR");

/**
 * O texto sem acentos e em minúsculas, mais o mapa de volta ao original. O mapa é por
 * grafema (a letra como a pessoa a vê): um emoji tem dois code units e "é" decomposto
 * tem dois caracteres, e o destaque não pode cortar nenhum dos dois ao meio.
 */
function normalizarComMapa(texto: string): TextoNormalizado {
  let normalizado = "";
  const inicios: number[] = [];
  const fins: number[] = [];

  for (const { segment, index } of segmentador.segment(texto)) {
    const parte = normalizarTexto(segment);
    for (let i = 0; i < parte.length; i++) {
      inicios.push(index);
      fins.push(index + segment.length);
    }
    normalizado += parte;
  }
  return { normalizado, inicios, fins };
}

/** Normalizar milhares de títulos a cada tecla seria o custo todo da busca; o título não muda entre as teclas. */
const LIMITE_DO_CACHE = 20_000;
const cacheDeTitulos = new Map<string, TextoNormalizado>();

function titulosNormalizados(titulo: string): TextoNormalizado {
  let guardado = cacheDeTitulos.get(titulo);
  if (!guardado) {
    if (cacheDeTitulos.size >= LIMITE_DO_CACHE) cacheDeTitulos.clear();
    guardado = normalizarComMapa(titulo);
    cacheDeTitulos.set(titulo, guardado);
  }
  return guardado;
}

type Acerto = { pontos: number; intervalos: Intervalo[] };

const ehLetraOuNumero = (letra: string | undefined) => letra !== undefined && /[\p{L}\p{N}]/u.test(letra);

function acharPalavra(palavra: string, alvo: TextoNormalizado): Acerto | null {
  const { normalizado, inicios, fins } = alvo;
  const intervaloDe = (inicio: number, fim: number): Intervalo => [inicios[inicio], fins[fim - 1]];

  if (normalizado === palavra) return { pontos: PONTOS.igual, intervalos: [intervaloDe(0, normalizado.length)] };
  if (normalizado.startsWith(palavra)) return { pontos: PONTOS.comeco, intervalos: [intervaloDe(0, palavra.length)] };

  // A primeira ocorrência que começa uma palavra, senão a primeira em qualquer lugar.
  let primeira = -1;
  for (let i = normalizado.indexOf(palavra); i !== -1; i = normalizado.indexOf(palavra, i + 1)) {
    if (primeira === -1) primeira = i;
    if (!ehLetraOuNumero(normalizado[i - 1])) {
      return { pontos: PONTOS.inicioDePalavra - Math.min(i, 100), intervalos: [intervaloDe(i, i + palavra.length)] };
    }
  }
  if (primeira !== -1) {
    return { pontos: PONTOS.meio - Math.min(primeira, 100), intervalos: [intervaloDe(primeira, primeira + palavra.length)] };
  }

  // Letras salteadas, na ordem (cada "letra" é um code point inteiro, para o emoji não ser partido).
  const achadas: Intervalo[] = [];
  let cursor = 0;
  let primeiraLetra = -1;
  for (const letra of palavra) {
    const posicao = normalizado.indexOf(letra, cursor);
    if (posicao === -1) return null;
    if (primeiraLetra === -1) primeiraLetra = posicao;
    achadas.push(intervaloDe(posicao, posicao + letra.length));
    cursor = posicao + letra.length;
  }

  // Quanto mais espalhadas as letras, menos a nota vale.
  const espalhamento = cursor - primeiraLetra - palavra.length;
  return { pontos: PONTOS.salteado - Math.min(espalhamento, 150), intervalos: unirIntervalos(achadas) };
}

function unirIntervalos(intervalos: Intervalo[]): Intervalo[] {
  const ordenados = [...intervalos].sort((a, b) => a[0] - b[0]);
  const unidos: Intervalo[] = [];
  for (const [inicio, fim] of ordenados) {
    const ultimo = unidos[unidos.length - 1];
    if (ultimo && inicio <= ultimo[1]) ultimo[1] = Math.max(ultimo[1], fim);
    else unidos.push([inicio, fim]);
  }
  return unidos;
}

function avaliar(nota: NotaParaBusca, palavras: readonly string[]): ResultadoDaBusca | null {
  const titulo = titulosNormalizados(nota.titulo);
  let caminho: string | undefined;

  let pontos = Infinity;
  const intervalos: Intervalo[] = [];

  for (const palavra of palavras) {
    const noTitulo = acharPalavra(palavra, titulo);
    if (noTitulo) {
      pontos = Math.min(pontos, noTitulo.pontos);
      intervalos.push(...noTitulo.intervalos);
      continue;
    }

    // Só quando o título não casa vale olhar o caminho — e só então ele é normalizado.
    caminho ??= normalizarTexto(juntarCaminho(nota.pasta, nota.titulo));
    if (!caminho.includes(palavra)) return null;
    // Casou só pelo caminho da pasta: vale, mas menos, e não há o que destacar no título.
    pontos = Math.min(pontos, PONTOS.salteado / 2);
  }

  return { nota, pontos, intervalos: unirIntervalos(intervalos) };
}

/**
 * Notas que casam com a consulta, da melhor para a pior. Consulta vazia lista
 * as abertas há pouco (na ordem delas) e depois as demais por nome.
 */
export function buscarPorTitulo(
  notas: readonly NotaParaBusca[],
  consulta: string,
  recentes: readonly IdDeNota[] = [],
  limite = LIMITE_PADRAO_DE_RESULTADOS,
): ResultadoDaBusca[] {
  const palavras = normalizarTexto(consulta).split(/\s+/).filter(Boolean);

  const posicaoDaRecente = new Map(recentes.map((id, posicao) => [id, posicao]));
  /** Quem nunca foi aberta vem depois de todas as recentes. */
  const posicaoRecente = (id: IdDeNota) => posicaoDaRecente.get(id) ?? Number.MAX_SAFE_INTEGER;

  const encontrados =
    palavras.length === 0
      ? notas.map((nota): ResultadoDaBusca => ({ nota, pontos: 0, intervalos: [] }))
      : notas.flatMap((nota) => avaliar(nota, palavras) ?? []);

  return encontrados
    .sort(
      (a, b) =>
        b.pontos - a.pontos ||
        posicaoRecente(a.nota.id) - posicaoRecente(b.nota.id) ||
        // Com consulta, o título mais curto é o mais "parecido"; sem consulta, é só ordem alfabética.
        (palavras.length > 0 ? a.nota.titulo.length - b.nota.titulo.length : 0) ||
        colador.compare(a.nota.titulo, b.nota.titulo),
    )
    .slice(0, limite);
}
