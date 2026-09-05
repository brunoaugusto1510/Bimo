/**
 * Domínio de Relação (Decisão 1/3 do Architecture Audit): liga dois nós do
 * grafo (Entidade ou Nota, via `nos`) com um tipo fechado. Diferente de
 * Entidade/Nota, não recebe a máquina de versionamento (Decisão 4) — uma
 * relação existe ou não existe, não é editada incrementalmente. Remover é só
 * marcar `removidoEm`/`removidoPor`, nunca apagar a linha (preserva
 * auditoria — seção 16 do doc de visão, "criar uma relação simples" é baixo
 * risco e auto-executável, mas ainda auditável).
 *
 * Antes de criar, confirma que origem e destino pertencem ao mesmo usuário
 * (Decisão 7 do Architecture Audit) — isso ainda não é um constraint em
 * nível de banco (exigiria um trigger, não desenhado nesta fase), então a
 * checagem fica aqui na camada de domínio.
 */

import { and, eq, inArray, isNull, or } from "drizzle-orm";
import { db } from "./db/cliente";
import { nos, relacoes } from "./db/schema";

export type Relacao = typeof relacoes.$inferSelect;
export type TipoRelacao = Relacao["tipo"];

type AutorDaEdicao = "usuario" | "agente";

export type NovaRelacao = {
  userId: string;
  origemId: number;
  destinoId: number;
  tipo: TipoRelacao;
  criadoPor: AutorDaEdicao;
  criadoPorFerramenta?: string;
};

/** Confirma que os dois nós existem e pertencem ao usuário — nunca cruza fronteira de dono. */
async function confirmarMesmoDono(userId: string, origemId: number, destinoId: number): Promise<void> {
  const encontrados = await db
    .select({ id: nos.id, userId: nos.userId })
    .from(nos)
    .where(inArray(nos.id, [origemId, destinoId]));

  const donoOrigem = encontrados.find((n) => n.id === origemId);
  const donoDestino = encontrados.find((n) => n.id === destinoId);

  if (!donoOrigem || donoOrigem.userId !== userId) {
    throw new Error(`Nó de origem ${origemId} não encontrado para este usuário.`);
  }
  if (!donoDestino || donoDestino.userId !== userId) {
    throw new Error(`Nó de destino ${destinoId} não encontrado para este usuário.`);
  }
}

/** Cria a Relação, depois de confirmar que origem e destino são do mesmo dono. */
export async function criarRelacao(nova: NovaRelacao): Promise<Relacao> {
  await confirmarMesmoDono(nova.userId, nova.origemId, nova.destinoId);

  const [linha] = await db
    .insert(relacoes)
    .values({
      userId: nova.userId,
      origemId: nova.origemId,
      destinoId: nova.destinoId,
      tipo: nova.tipo,
      criadoPor: nova.criadoPor,
      criadoPorFerramenta: nova.criadoPorFerramenta,
    })
    .returning();

  return linha;
}

/** Marca a Relação como removida — nunca apaga a linha (auditoria). */
export async function removerRelacao(
  userId: string,
  id: number,
  removidoPor: AutorDaEdicao,
): Promise<Relacao> {
  const [linha] = await db
    .update(relacoes)
    .set({ removidoEm: new Date(), removidoPor })
    .where(and(eq(relacoes.id, id), eq(relacoes.userId, userId)))
    .returning();

  if (!linha) {
    throw new Error(`Relação ${id} não encontrada para este usuário.`);
  }

  return linha;
}

/** Relações ativas (não removidas) que tocam um nó, como origem ou destino. */
export async function listarRelacoesDoNo(userId: string, noId: number): Promise<Relacao[]> {
  return db
    .select()
    .from(relacoes)
    .where(
      and(
        eq(relacoes.userId, userId),
        isNull(relacoes.removidoEm),
        or(eq(relacoes.origemId, noId), eq(relacoes.destinoId, noId)),
      ),
    );
}
