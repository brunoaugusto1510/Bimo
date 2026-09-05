/**
 * Full-text search nativa do Postgres (Fase 4 - Retrieval, "Busca textual")
 * sobre `notas` (título+tags+conteúdo) e `entidades` (nome+aliases+tipo).
 *
 * Decisões de design:
 *
 * - União discriminada (`ResultadoNota | ResultadoEntidade`) em vez de um
 *   único formato genérico: os dois domínios têm campos que não fazem
 *   sentido no outro (`trecho`/`pasta` só existem em Nota; `categoria`/
 *   `aliases` só em Entidade) — forçar um formato comum obrigaria campos
 *   `null` artificiais ou um `Record<string, unknown>` sem tipagem real.
 *
 * - `buscarNoConhecimento` NÃO achata os dois resultados num ranking único:
 *   `ts_rank` de `notas.vetor_busca` e de `entidades.vetor_busca` não são
 *   comparáveis entre si (pesos/tamanho de documento diferentes) — combinar
 *   os dois num único score ordenado exigiria normalização cross-tabela,
 *   que é o trabalho do item "Reranking" do roadmap, fora de escopo aqui.
 *
 * - `websearch_to_tsquery` (nunca `plainto_tsquery`/`to_tsquery`): é a única
 *   das três que (a) aceita a sintaxe que usuário/agente realmente digitam
 *   (`"frase exata"`, `-excluir`, `OR`) e (b) nunca lança erro de sintaxe —
 *   qualquer entrada, por mais estranha, vira uma tsquery válida (mesmo que
 *   vazia). Importante para texto livre vindo de um agente de LLM.
 *
 * - `ts_headline` só é chamado para Nota, e numa query EXTERNA sobre uma
 *   subquery que já filtrou (`@@`), rankeou (`ts_rank`) e limitou
 *   (`limit`): `ts_headline` reprocessa o documento inteiro do zero (não
 *   usa o índice GIN nem o `vetor_busca` já calculado), então rodá-lo antes
 *   do `limit` custaria isso para cada linha candidata em vez de só para as
 *   que de fato voltam ao usuário.
 */

import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "./db/cliente";
import { entidades, notas } from "./db/schema";

export type ResultadoNota = {
  tipo: "nota";
  id: number;
  titulo: string;
  pasta: string | null;
  /** Delimitado com `**` (estilo markdown) — nunca tags HTML. */
  trecho: string;
  /** `ts_rank` normalizado (divisor 32) — sempre entre 0 e 1. */
  pontuacao: number;
};

export type ResultadoEntidade = {
  tipo: "entidade";
  id: number;
  nome: string;
  /** Coluna `entidades.tipo` — renomeada aqui para não colidir com o discriminante `tipo`. */
  categoria: string | null;
  aliases: string[] | null;
  pontuacao: number;
};

export type ResultadoDeBusca = ResultadoNota | ResultadoEntidade;

export type OpcoesDeBusca = {
  /** Padrão 10, sempre restrito a 1–50. */
  limite?: number;
};

const CONFIGURACAO_BUSCA = "public.portugues_sem_acento";
const LIMITE_PADRAO = 10;
const LIMITE_MINIMO = 1;
const LIMITE_MAXIMO = 50;
/** Divisor de normalização do `ts_rank` — 32 = `rank/(rank+1)`, sempre em 0–1. */
const NORMALIZACAO_RANK = 32;

function normalizarLimite(limite: number | undefined): number {
  if (limite === undefined || Number.isNaN(limite)) return LIMITE_PADRAO;
  return Math.min(Math.max(limite, LIMITE_MINIMO), LIMITE_MAXIMO);
}

function consultaEstaVazia(consulta: string): boolean {
  return consulta.trim() === "";
}

/** Busca notas por texto livre, restrita ao dono. Vazio → `[]` sem tocar o banco. */
export async function buscarNotasPorTexto(
  userId: string,
  consulta: string,
  opcoes?: OpcoesDeBusca,
): Promise<ResultadoNota[]> {
  if (consultaEstaVazia(consulta)) return [];

  const limite = normalizarLimite(opcoes?.limite);
  const consultaTs = sql`websearch_to_tsquery(${CONFIGURACAO_BUSCA}, ${consulta})`;

  const candidatas = db
    .select({
      id: notas.id,
      titulo: notas.titulo,
      pasta: notas.pasta,
      conteudo: notas.conteudo,
      atualizadoEm: notas.atualizadoEm,
      pontuacao: sql<number>`ts_rank(${notas.vetorBusca}, ${consultaTs}, ${NORMALIZACAO_RANK})`.as(
        "pontuacao",
      ),
    })
    .from(notas)
    .where(and(eq(notas.userId, userId), sql`${notas.vetorBusca} @@ ${consultaTs}`))
    .orderBy(sql`pontuacao desc`, desc(notas.atualizadoEm))
    .limit(limite)
    .as("notas_candidatas");

  const linhas = await db
    .select({
      id: candidatas.id,
      titulo: candidatas.titulo,
      pasta: candidatas.pasta,
      pontuacao: candidatas.pontuacao,
      trecho: sql<string>`ts_headline(${CONFIGURACAO_BUSCA}, ${candidatas.conteudo}, ${consultaTs}, 'StartSel=**, StopSel=**')`,
    })
    .from(candidatas)
    .orderBy(desc(candidatas.pontuacao));

  return linhas.map((linha) => ({
    tipo: "nota" as const,
    id: linha.id,
    titulo: linha.titulo,
    pasta: linha.pasta,
    trecho: linha.trecho,
    pontuacao: Number(linha.pontuacao),
  }));
}

/** Busca entidades por texto livre, restrita ao dono. Vazio → `[]` sem tocar o banco. */
export async function buscarEntidadesPorTexto(
  userId: string,
  consulta: string,
  opcoes?: OpcoesDeBusca,
): Promise<ResultadoEntidade[]> {
  if (consultaEstaVazia(consulta)) return [];

  const limite = normalizarLimite(opcoes?.limite);
  const consultaTs = sql`websearch_to_tsquery(${CONFIGURACAO_BUSCA}, ${consulta})`;

  const linhas = await db
    .select({
      id: entidades.id,
      nome: entidades.nome,
      categoria: entidades.tipo,
      aliases: entidades.aliases,
      pontuacao: sql<number>`ts_rank(${entidades.vetorBusca}, ${consultaTs}, ${NORMALIZACAO_RANK})`.as(
        "pontuacao",
      ),
    })
    .from(entidades)
    .where(and(eq(entidades.userId, userId), sql`${entidades.vetorBusca} @@ ${consultaTs}`))
    .orderBy(sql`pontuacao desc`, desc(entidades.atualizadoEm))
    .limit(limite);

  return linhas.map((linha) => ({
    tipo: "entidade" as const,
    id: linha.id,
    nome: linha.nome,
    categoria: linha.categoria,
    aliases: linha.aliases,
    pontuacao: Number(linha.pontuacao),
  }));
}

/**
 * Busca simultânea nos dois domínios. Devolve os resultados separados —
 * ver comentário de topo sobre por que não achatar num ranking único.
 */
export async function buscarNoConhecimento(
  userId: string,
  consulta: string,
  opcoes?: OpcoesDeBusca,
): Promise<{ notas: ResultadoNota[]; entidades: ResultadoEntidade[] }> {
  const [notasEncontradas, entidadesEncontradas] = await Promise.all([
    buscarNotasPorTexto(userId, consulta, opcoes),
    buscarEntidadesPorTexto(userId, consulta, opcoes),
  ]);

  return { notas: notasEncontradas, entidades: entidadesEncontradas };
}
