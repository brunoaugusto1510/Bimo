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

/** O texto sem acentos e em minúsculas, mais, para cada letra dele, a posição da letra no original. */
function normalizarComMapa(texto: string): { normalizado: string; origem: number[] } {
  let normalizado = "";
  const origem: number[] = [];
  let posicao = 0;

  for (const letra of texto) {
    const parte = normalizarTexto(letra);
    for (let i = 0; i < parte.length; i++) origem.push(posicao);
    normalizado += parte;
    posicao += letra.length;
  }
  return { normalizado, origem };
}

type Acerto = { pontos: number; intervalos: Intervalo[] };

const ehLetraOuNumero = (letra: string | undefined) => letra !== undefined && /[\p{L}\p{N}]/u.test(letra);

function acharPalavra(palavra: string, alvo: string, origem: readonly number[], tamanhoOriginal: number): Acerto | null {
  const intervaloDe = (inicio: number, fim: number): Intervalo => [origem[inicio], (origem[fim - 1] ?? tamanhoOriginal - 1) + 1];

  if (alvo === palavra) return { pontos: PONTOS.igual, intervalos: [intervaloDe(0, alvo.length)] };
  if (alvo.startsWith(palavra)) return { pontos: PONTOS.comeco, intervalos: [intervaloDe(0, palavra.length)] };

  // A primeira ocorrência que começa uma palavra, senão a primeira em qualquer lugar.
  let primeira = -1;
  for (let i = alvo.indexOf(palavra); i !== -1; i = alvo.indexOf(palavra, i + 1)) {
    if (primeira === -1) primeira = i;
    if (!ehLetraOuNumero(alvo[i - 1])) {
      return { pontos: PONTOS.inicioDePalavra - Math.min(i, 100), intervalos: [intervaloDe(i, i + palavra.length)] };
    }
  }
  if (primeira !== -1) {
    return { pontos: PONTOS.meio - Math.min(primeira, 100), intervalos: [intervaloDe(primeira, primeira + palavra.length)] };
  }

  // Letras salteadas, na ordem.
  const posicoes: number[] = [];
  let cursor = 0;
  for (const letra of palavra) {
    const achada = alvo.indexOf(letra, cursor);
    if (achada === -1) return null;
    posicoes.push(achada);
    cursor = achada + 1;
  }

  const intervalos: Intervalo[] = [];
  for (const posicao of posicoes) {
    const ultimo = intervalos[intervalos.length - 1];
    const inicio = origem[posicao];
    const fim = inicio + 1;
    if (ultimo && ultimo[1] >= inicio) ultimo[1] = fim;
    else intervalos.push([inicio, fim]);
  }
  const espalhamento = posicoes[posicoes.length - 1] - posicoes[0] + 1 - palavra.length;
  return { pontos: PONTOS.salteado - Math.min(espalhamento, 150), intervalos };
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
  const titulo = normalizarComMapa(nota.titulo);
  const caminho = normalizarTexto(juntarCaminho(nota.pasta, nota.titulo));

  let pontos = Infinity;
  const intervalos: Intervalo[] = [];

  for (const palavra of palavras) {
    const noTitulo = acharPalavra(palavra, titulo.normalizado, titulo.origem, nota.titulo.length);
    if (noTitulo) {
      pontos = Math.min(pontos, noTitulo.pontos);
      intervalos.push(...noTitulo.intervalos);
    } else if (caminho.includes(palavra)) {
      // Casou só pelo caminho da pasta: vale, mas menos, e não há o que destacar no título.
      pontos = Math.min(pontos, PONTOS.salteado / 2);
    } else {
      return null;
    }
  }

  return { nota, pontos, intervalos: unirIntervalos(intervalos) };
}

const comparar = (a: string, b: string) => a.localeCompare(b, "pt-BR");

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
  const posicaoRecente = (id: IdDeNota) => {
    const posicao = recentes.indexOf(id);
    return posicao === -1 ? Infinity : posicao;
  };

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
        comparar(a.nota.titulo, b.nota.titulo),
    )
    .slice(0, limite);
}
