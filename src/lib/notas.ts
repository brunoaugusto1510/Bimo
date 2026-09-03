/**
 * Domínio de Nota (Decisão 1 do Architecture Audit): documento pesado,
 * majoritariamente autoral do usuário. Mesma estrutura de `entidades.ts`
 * (nó em `nos` + registro próprio + versionamento em `versoes_nota`), mas
 * sem os campos de workflow do agente (`confianca`/`status` — isso é
 * problema da Entidade, não da Nota) e com `pasta`, que a Entidade não tem
 * (Decisão 4 da Fase 2: organização/cor no grafo, nunca um nó ou relação).
 *
 * Como em `entidades.ts`, não existe `removerNota` — a seção 14 do doc de
 * visão não lista ferramenta de exclusão de nota. E, como lá, o enforcement
 * de risco/autonomia (Decisão 5 do Architecture Audit) fica pra camada de
 * ferramentas do agente, não para esta camada de dados.
 */

import { and, desc, eq } from "drizzle-orm";
import { db } from "./db/cliente";
import { nos, notas, versoesNota } from "./db/schema";

/**
 * `vetorBusca` (coluna gerada para full-text search, ver `db/schema/notas.ts`)
 * fica de fora: é uso interno do Postgres, nunca precisa trafegar até a
 * aplicação — por isso as leituras abaixo usam projeção explícita em vez de
 * `db.select()` genérico.
 */
export type Nota = Omit<typeof notas.$inferSelect, "vetorBusca">;

const colunasDaNota = {
  id: notas.id,
  userId: notas.userId,
  titulo: notas.titulo,
  conteudo: notas.conteudo,
  pasta: notas.pasta,
  tags: notas.tags,
  criadoPor: notas.criadoPor,
  criadoPorFerramenta: notas.criadoPorFerramenta,
  criadoEm: notas.criadoEm,
  atualizadoEm: notas.atualizadoEm,
};

type AutorDaEdicao = "usuario" | "agente";

export type NovaNota = {
  userId: string;
  titulo: string;
  conteudo: string;
  pasta?: string;
  tags?: string[];
  criadoPor: AutorDaEdicao;
  criadoPorFerramenta?: string;
};

export type AtualizacaoNota = {
  titulo?: string;
  conteudo?: string;
  pasta?: string | null;
  tags?: string[] | null;
  /** Autoria desta edição específica — vira a autoria da nova versão, não sobrescreve o `criadoPor` original da nota. */
  editadoPor: AutorDaEdicao;
  editadoPorFerramenta?: string;
};

/** Cria a Nota (via `nos` + `notas`) e já registra a versão inicial (v1). */
export async function criarNota(nova: NovaNota): Promise<Nota> {
  return db.transaction(async (tx) => {
    const [{ id }] = await tx
      .insert(nos)
      .values({ tipo: "nota", userId: nova.userId })
      .returning({ id: nos.id });

    const [linha] = await tx
      .insert(notas)
      .values({
        id,
        userId: nova.userId,
        titulo: nova.titulo,
        conteudo: nova.conteudo,
        pasta: nova.pasta,
        tags: nova.tags,
        criadoPor: nova.criadoPor,
        criadoPorFerramenta: nova.criadoPorFerramenta,
      })
      .returning(colunasDaNota);

    await tx.insert(versoesNota).values({
      notaId: linha.id,
      userId: linha.userId,
      titulo: linha.titulo,
      conteudo: linha.conteudo,
      pasta: linha.pasta,
      tags: linha.tags,
      criadoPor: linha.criadoPor,
      criadoPorFerramenta: linha.criadoPorFerramenta,
    });

    return linha;
  });
}

/** Atualiza a Nota e registra o novo estado inteiro em `versoes_nota`. */
export async function atualizarNota(
  userId: string,
  id: number,
  mudancas: AtualizacaoNota,
): Promise<Nota> {
  return db.transaction(async (tx) => {
    const valores: Partial<typeof notas.$inferInsert> = { atualizadoEm: new Date() };
    if (mudancas.titulo !== undefined) valores.titulo = mudancas.titulo;
    if (mudancas.conteudo !== undefined) valores.conteudo = mudancas.conteudo;
    if (mudancas.pasta !== undefined) valores.pasta = mudancas.pasta;
    if (mudancas.tags !== undefined) valores.tags = mudancas.tags;

    const [linha] = await tx
      .update(notas)
      .set(valores)
      .where(and(eq(notas.id, id), eq(notas.userId, userId)))
      .returning(colunasDaNota);

    if (!linha) {
      throw new Error(`Nota ${id} não encontrada para este usuário.`);
    }

    await tx.insert(versoesNota).values({
      notaId: linha.id,
      userId: linha.userId,
      titulo: linha.titulo,
      conteudo: linha.conteudo,
      pasta: linha.pasta,
      tags: linha.tags,
      criadoPor: mudancas.editadoPor,
      criadoPorFerramenta: mudancas.editadoPorFerramenta,
    });

    return linha;
  });
}

/** Busca uma Nota por id, restrita ao dono. */
export async function obterNota(userId: string, id: number): Promise<Nota | undefined> {
  const [linha] = await db
    .select(colunasDaNota)
    .from(notas)
    .where(and(eq(notas.id, id), eq(notas.userId, userId)));
  return linha;
}

/** Lista as Notas de um usuário, mais recentes primeiro. */
export async function listarNotas(userId: string): Promise<Nota[]> {
  return db
    .select(colunasDaNota)
    .from(notas)
    .where(eq(notas.userId, userId))
    .orderBy(desc(notas.criadoEm));
}
