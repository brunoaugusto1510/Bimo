/**
 * Domínio de Fonte (Decisão 1 do Architecture Audit): blob imutável, gravado
 * uma vez no Supabase Storage e nunca editado depois. Por isso não existe
 * `atualizarFonte` — só criar e ler. Reingerir o mesmo material cria uma
 * Fonte nova (caminho novo no Storage), nunca sobrescreve a existente.
 *
 * Todas as funções recebem `userId` explicitamente — a sessão atual (senha
 * única, sem contas de usuário) ainda não mapeia requisição -> usuário, mas
 * o modelo de dados já é multiusuário (Decisão 7) e o filtro por `userId` é
 * hoje a única linha de defesa real: o app conecta no Postgres com um papel
 * que ignora RLS, então a política de dono cadastrada no schema fica dormente
 * até existir autenticação de verdade (ver seção "ainda não decidido" do doc
 * de visão).
 */

import { createHash, randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { db } from "./db/cliente";
import { fontes } from "./db/schema";
import { enviarArquivo, getConfigStorage, removerArquivo } from "./supabase-storage";

export type Fonte = typeof fontes.$inferSelect;

export type NovaFonte = {
  userId: string;
  conteudo: Buffer;
  nomeArquivoOriginal: string;
  tipoMime?: string;
};

/**
 * Envia os bytes pro Storage e só então insere a linha no banco. Se o insert
 * falhar, remove o blob já enviado (compensação — evita ficar com um arquivo
 * órfão sem registro nenhum apontando pra ele).
 */
export async function criarFonte(nova: NovaFonte): Promise<Fonte> {
  const cfg = getConfigStorage();
  const caminho = `${nova.userId}/${randomUUID()}`;
  const hashConteudo = createHash("sha256").update(nova.conteudo).digest("hex");

  await enviarArquivo(cfg, caminho, nova.conteudo, nova.tipoMime);

  try {
    const [linha] = await db
      .insert(fontes)
      .values({
        userId: nova.userId,
        caminhoArmazenamento: caminho,
        nomeArquivoOriginal: nova.nomeArquivoOriginal,
        tipoMime: nova.tipoMime,
        hashConteudo,
      })
      .returning();
    return linha;
  } catch (erro) {
    await removerArquivo(cfg, caminho).catch(() => {
      // Melhor esforço: se a remoção também falhar, o erro original (do
      // insert) é o que importa reportar — não mascarar um pelo outro.
    });
    throw erro;
  }
}

/** Busca uma Fonte por id, restrita ao dono — nunca vaza fonte de outro usuário. */
export async function obterFonte(userId: string, id: number): Promise<Fonte | undefined> {
  const [linha] = await db
    .select()
    .from(fontes)
    .where(and(eq(fontes.id, id), eq(fontes.userId, userId)));
  return linha;
}

/** Lista as Fontes de um usuário, mais recentes primeiro. */
export async function listarFontes(userId: string): Promise<Fonte[]> {
  return db.select().from(fontes).where(eq(fontes.userId, userId)).orderBy(desc(fontes.criadoEm));
}
