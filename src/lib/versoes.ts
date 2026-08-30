/**
 * Domínio de Revisões (Decisão 4 do Architecture Audit): consulta e
 * restauração das versões que `criarEntidade`/`atualizarEntidade` e
 * `criarNota`/`atualizarNota` já gravam a cada chamada.
 *
 * Restaurar nunca reescreve histórico: chama o próprio `atualizarEntidade`/
 * `atualizarNota` com o conteúdo da versão antiga, o que gera uma versão
 * *nova* (equivalente a um `git revert`) — as versões intermediárias
 * continuam intactas.
 */

import { and, desc, eq } from "drizzle-orm";
import { db } from "./db/cliente";
import { versoesEntidade, versoesNota } from "./db/schema";
import { atualizarEntidade, type Entidade } from "./entidades";
import { atualizarNota, type Nota } from "./notas";

export type VersaoEntidade = typeof versoesEntidade.$inferSelect;
export type VersaoNota = typeof versoesNota.$inferSelect;

type AutorDaEdicao = "usuario" | "agente";

/** Histórico de uma Entidade, mais recente primeiro. */
export async function listarVersoesEntidade(
  userId: string,
  entidadeId: number,
): Promise<VersaoEntidade[]> {
  return db
    .select()
    .from(versoesEntidade)
    .where(and(eq(versoesEntidade.entidadeId, entidadeId), eq(versoesEntidade.userId, userId)))
    .orderBy(desc(versoesEntidade.versionadoEm));
}

/** Restaura uma versão antiga de Entidade — cria uma versão nova com aquele conteúdo. */
export async function restaurarVersaoEntidade(
  userId: string,
  entidadeId: number,
  versaoId: number,
  restauradoPor: AutorDaEdicao,
): Promise<Entidade> {
  const [versao] = await db
    .select()
    .from(versoesEntidade)
    .where(
      and(
        eq(versoesEntidade.id, versaoId),
        eq(versoesEntidade.entidadeId, entidadeId),
        eq(versoesEntidade.userId, userId),
      ),
    );

  if (!versao) {
    throw new Error(`Versão ${versaoId} não encontrada para esta entidade.`);
  }

  return atualizarEntidade(userId, entidadeId, {
    nome: versao.nome,
    tipo: versao.tipo,
    aliases: versao.aliases,
    confianca: versao.confianca === null ? null : Number(versao.confianca),
    status: versao.status,
    editadoPor: restauradoPor,
  });
}

/** Histórico de uma Nota, mais recente primeiro. */
export async function listarVersoesNota(userId: string, notaId: number): Promise<VersaoNota[]> {
  return db
    .select()
    .from(versoesNota)
    .where(and(eq(versoesNota.notaId, notaId), eq(versoesNota.userId, userId)))
    .orderBy(desc(versoesNota.versionadoEm));
}

/** Restaura uma versão antiga de Nota — cria uma versão nova com aquele conteúdo. */
export async function restaurarVersaoNota(
  userId: string,
  notaId: number,
  versaoId: number,
  restauradoPor: AutorDaEdicao,
): Promise<Nota> {
  const [versao] = await db
    .select()
    .from(versoesNota)
    .where(
      and(eq(versoesNota.id, versaoId), eq(versoesNota.notaId, notaId), eq(versoesNota.userId, userId)),
    );

  if (!versao) {
    throw new Error(`Versão ${versaoId} não encontrada para esta nota.`);
  }

  return atualizarNota(userId, notaId, {
    titulo: versao.titulo,
    conteudo: versao.conteudo,
    pasta: versao.pasta,
    tags: versao.tags,
    editadoPor: restauradoPor,
  });
}
