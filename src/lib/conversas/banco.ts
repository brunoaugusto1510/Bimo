import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../db/cliente";
import { conversas, mensagensDeConversa } from "../db/schema";
import { REGEX_UUID } from "../repositorio-de-notas/config";
import type { Mensagem } from "../types";
import {
  ErroDeConversa,
  LIMITE_DA_LISTA,
  LIMITE_DE_MENSAGENS_ABERTAS,
  prepararMensagens,
  tituloDaConversa,
  type RepositorioDeConversas,
  type ResumoDeConversa,
} from "./tipos";

type LinhaDeResumo = { id: string; titulo: string; atualizadaEm: Date };

function paraResumo({ id, titulo, atualizadaEm }: LinhaDeResumo): ResumoDeConversa {
  return { id, titulo, atualizadaEm: atualizadaEm.toISOString() };
}

/** Toda consulta filtra por `user_id`: o app conecta como dono do banco, então a RLS não protege aqui. */
export function criarRepositorioDeConversasDoBanco(userId: string): RepositorioDeConversas {
  return {
    async listar(limite = LIMITE_DA_LISTA) {
      const linhas = await db
        .select({ id: conversas.id, titulo: conversas.titulo, atualizadaEm: conversas.atualizadaEm })
        .from(conversas)
        .where(eq(conversas.userId, userId))
        .orderBy(desc(conversas.atualizadaEm), desc(conversas.id))
        .limit(limite);
      return linhas.map(paraResumo);
    },

    async obter(id) {
      if (!REGEX_UUID.test(id)) return null;
      const [conversa] = await db
        .select({ id: conversas.id, titulo: conversas.titulo, atualizadaEm: conversas.atualizadaEm })
        .from(conversas)
        .where(and(eq(conversas.id, id), eq(conversas.userId, userId)));
      if (!conversa) return null;

      const recentes = await db
        .select({
          id: mensagensDeConversa.id,
          papel: mensagensDeConversa.papel,
          conteudo: mensagensDeConversa.conteudo,
          ferramentas: mensagensDeConversa.ferramentas,
          fontes: mensagensDeConversa.fontes,
        })
        .from(mensagensDeConversa)
        .where(and(eq(mensagensDeConversa.conversaId, id), eq(mensagensDeConversa.userId, userId)))
        .orderBy(desc(mensagensDeConversa.seq))
        .limit(LIMITE_DE_MENSAGENS_ABERTAS);

      const mensagens: Mensagem[] = recentes.reverse().map(({ ferramentas, fontes, ...resto }) => ({
        ...resto,
        ...(ferramentas?.length ? { ferramentas } : {}),
        ...(fontes?.length ? { fontes } : {}),
      }));
      return { conversa: paraResumo(conversa), mensagens };
    },

    async acrescentar(id, mensagens) {
      const novas = prepararMensagens(mensagens);
      if (!REGEX_UUID.test(id) || novas.some((m) => !REGEX_UUID.test(m.id))) {
        throw new ErroDeConversa("invalida", "Identificador inválido.");
      }

      return db.transaction(async (tx) => {
        await tx.insert(conversas).values({ id, userId, titulo: tituloDaConversa(novas) }).onConflictDoNothing();
        const [dona] = await tx.select({ userId: conversas.userId }).from(conversas).where(eq(conversas.id, id));
        if (dona?.userId !== userId) throw new ErroDeConversa("nao-encontrada", "Conversa não encontrada.");

        const gravadas = await tx
          .insert(mensagensDeConversa)
          .values(novas.map((m) => ({
            id: m.id,
            conversaId: id,
            userId,
            papel: m.papel,
            conteudo: m.conteudo,
            ferramentas: m.ferramentas ?? null,
            fontes: m.fontes ?? null,
          })))
          .onConflictDoNothing()
          .returning({ id: mensagensDeConversa.id });

        // Repetir só mensagens que já estavam lá não mexe na hora da conversa.
        const dela = and(eq(conversas.id, id), eq(conversas.userId, userId));
        const colunas = { id: conversas.id, titulo: conversas.titulo, atualizadaEm: conversas.atualizadaEm };
        const [resumo] = gravadas.length > 0
          ? await tx.update(conversas).set({ atualizadaEm: sql`now()` }).where(dela).returning(colunas)
          : await tx.select(colunas).from(conversas).where(dela);
        return paraResumo(resumo);
      });
    },

    async excluir(id) {
      if (!REGEX_UUID.test(id)) return false;
      const apagadas = await db
        .delete(conversas)
        .where(and(eq(conversas.id, id), eq(conversas.userId, userId)))
        .returning({ id: conversas.id });
      return apagadas.length > 0;
    },
  };
}
