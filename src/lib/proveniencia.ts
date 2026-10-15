/**
 * Domínio de Proveniência (Decisão 2, Camada 2 do Architecture Audit): liga
 * uma Fonte à Entidade/Nota que ela ajudou a originar ou embasar. Espelha
 * `relacoes.ts` na forma — confirma dono antes de gravar, usa `nos` como
 * ponto único pra checar Entidade/Nota (mesma identidade compartilhada) — mas
 * é mais simples: não tem "remover" nem versionamento. O vínculo existe ou
 * não existe; uma vez gravado não se desfaz, porque apagar proveniência
 * apagaria a explicação de onde o conhecimento veio (Princípio 2 do doc de
 * visão: "toda informação importante deve possuir proveniência").
 *
 * `locator` fica reservado (Decisão 4 da Fase 3 / comentário em
 * `db/schema/proveniencia.ts`) pra granularidade de citação — não usado
 * ainda, só repassado se quem chama já tiver esse dado.
 */

import { and, eq, or } from "drizzle-orm";
import { db } from "./db/cliente";
import { fontes, nos, proveniencia } from "./db/schema";

export type Proveniencia = typeof proveniencia.$inferSelect;

export type NovoVinculo = {
  userId: string;
  fonteId: number;
  locator?: string;
} & ({ entidadeId: number; notaId?: never } | { notaId: number; entidadeId?: never });

/** Confirma que a Fonte e o nó (Entidade ou Nota, via `nos`) pertencem ao mesmo usuário. */
async function confirmarDonoDaFonteEDoNo(userId: string, fonteId: number, noId: number): Promise<void> {
  const [fonte] = await db
    .select({ id: fontes.id })
    .from(fontes)
    .where(and(eq(fontes.id, fonteId), eq(fontes.userId, userId)));
  if (!fonte) {
    throw new Error(`Fonte ${fonteId} não encontrada para este usuário.`);
  }

  const [no] = await db
    .select({ id: nos.id })
    .from(nos)
    .where(and(eq(nos.id, noId), eq(nos.userId, userId)));
  if (!no) {
    throw new Error(`Nó ${noId} (Entidade ou Nota) não encontrado para este usuário.`);
  }
}

/** Grava que uma Fonte ajudou a originar (ou embasar) uma Entidade/Nota. */
export async function vincularFonte(vinculo: NovoVinculo): Promise<Proveniencia> {
  const noId = vinculo.entidadeId ?? vinculo.notaId;
  await confirmarDonoDaFonteEDoNo(vinculo.userId, vinculo.fonteId, noId);

  const [linha] = await db
    .insert(proveniencia)
    .values({
      userId: vinculo.userId,
      fonteId: vinculo.fonteId,
      entidadeId: vinculo.entidadeId,
      notaId: vinculo.notaId,
      locator: vinculo.locator,
    })
    .returning();

  return linha;
}

/** Todas as Entidades/Notas que uma Fonte ajudou a originar. */
export async function listarProvenienciaDaFonte(userId: string, fonteId: number): Promise<Proveniencia[]> {
  return db
    .select()
    .from(proveniencia)
    .where(and(eq(proveniencia.userId, userId), eq(proveniencia.fonteId, fonteId)));
}

/** Todas as Fontes que embasaram um nó (Entidade ou Nota) específico. */
export async function listarFontesDoNo(userId: string, noId: number): Promise<Proveniencia[]> {
  return db
    .select()
    .from(proveniencia)
    .where(
      and(
        eq(proveniencia.userId, userId),
        or(eq(proveniencia.entidadeId, noId), eq(proveniencia.notaId, noId)),
      ),
    );
}
