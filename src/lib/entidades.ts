/**
 * Domínio de Entidade (Decisão 1 do Architecture Audit): nó leve do grafo de
 * conhecimento, majoritariamente criado pelo agente. Diferente de Fonte, é
 * editável — cada edição gera uma nova linha em `versoes_entidade` (snapshot
 * completo, Decisão 4), nunca sobrescreve nem apaga uma versão anterior.
 *
 * Criar/atualizar exige duas (ou três) inserções relacionadas — `nos` +
 * `entidades` (+ `versoes_entidade`) — por isso usam `db.transaction`: ou
 * tudo é gravado, ou nada é (diferente de Fonte, que precisa de compensação
 * manual porque o Storage não participa da transação do Postgres).
 *
 * Não existe `removerEntidade`: a seção 14 do doc de visão não lista uma
 * ferramenta de exclusão de entidade — o modelo favorece merge/substituição
 * (`substitui`, Decisão 3) sobre apagar conhecimento.
 *
 * Enforcement de risco/autonomia (Decisão 5 — ex.: bloquear edição de uma
 * entidade `aprovada`/`mesclada` sem aprovação) é responsabilidade da camada
 * de ferramentas do agente (ainda não escrita), não deste módulo: esta é só
 * a camada de dados, usada tanto por humano quanto por agente.
 *
 * Como em `fontes.ts`, todas as funções recebem `userId` explicitamente —
 * ver o comentário equivalente lá sobre por que isso importa hoje.
 */

import { and, desc, eq } from "drizzle-orm";
import { db } from "./db/cliente";
import { entidades, nos, versoesEntidade } from "./db/schema";

export type Entidade = typeof entidades.$inferSelect;

type AutorDaEdicao = "usuario" | "agente";
type StatusEntidade = "rascunho" | "aprovada" | "mesclada";

export type NovaEntidade = {
  userId: string;
  nome: string;
  tipo?: string;
  aliases?: string[];
  /** 0 a 1 — convertido para o formato numeric(3,2) da coluna. */
  confianca?: number;
  status?: StatusEntidade;
  criadoPor: AutorDaEdicao;
  criadoPorFerramenta?: string;
};

export type AtualizacaoEntidade = {
  nome?: string;
  tipo?: string | null;
  aliases?: string[] | null;
  confianca?: number | null;
  status?: StatusEntidade;
  /** Autoria desta edição específica — vira a autoria da nova versão, não sobrescreve o `criadoPor` original da entidade. */
  editadoPor: AutorDaEdicao;
  editadoPorFerramenta?: string;
};

function formatarConfianca(confianca: number | null | undefined): string | null | undefined {
  if (confianca === undefined) return undefined;
  return confianca === null ? null : confianca.toFixed(2);
}

/** Cria a Entidade (via `nos` + `entidades`) e já registra a versão inicial (v1). */
export async function criarEntidade(nova: NovaEntidade): Promise<Entidade> {
  return db.transaction(async (tx) => {
    const [{ id }] = await tx
      .insert(nos)
      .values({ tipo: "entidade", userId: nova.userId })
      .returning({ id: nos.id });

    const [linha] = await tx
      .insert(entidades)
      .values({
        id,
        userId: nova.userId,
        nome: nova.nome,
        tipo: nova.tipo,
        aliases: nova.aliases,
        confianca: formatarConfianca(nova.confianca),
        status: nova.status ?? "rascunho",
        criadoPor: nova.criadoPor,
        criadoPorFerramenta: nova.criadoPorFerramenta,
      })
      .returning();

    await tx.insert(versoesEntidade).values({
      entidadeId: linha.id,
      userId: linha.userId,
      nome: linha.nome,
      tipo: linha.tipo,
      aliases: linha.aliases,
      confianca: linha.confianca,
      status: linha.status,
      criadoPor: linha.criadoPor,
      criadoPorFerramenta: linha.criadoPorFerramenta,
    });

    return linha;
  });
}

/** Atualiza a Entidade e registra o novo estado inteiro em `versoes_entidade`. */
export async function atualizarEntidade(
  userId: string,
  id: number,
  mudancas: AtualizacaoEntidade,
): Promise<Entidade> {
  return db.transaction(async (tx) => {
    const valores: Partial<typeof entidades.$inferInsert> = { atualizadoEm: new Date() };
    if (mudancas.nome !== undefined) valores.nome = mudancas.nome;
    if (mudancas.tipo !== undefined) valores.tipo = mudancas.tipo;
    if (mudancas.aliases !== undefined) valores.aliases = mudancas.aliases;
    if (mudancas.confianca !== undefined) valores.confianca = formatarConfianca(mudancas.confianca);
    if (mudancas.status !== undefined) valores.status = mudancas.status;

    const [linha] = await tx
      .update(entidades)
      .set(valores)
      .where(and(eq(entidades.id, id), eq(entidades.userId, userId)))
      .returning();

    if (!linha) {
      throw new Error(`Entidade ${id} não encontrada para este usuário.`);
    }

    await tx.insert(versoesEntidade).values({
      entidadeId: linha.id,
      userId: linha.userId,
      nome: linha.nome,
      tipo: linha.tipo,
      aliases: linha.aliases,
      confianca: linha.confianca,
      status: linha.status,
      criadoPor: mudancas.editadoPor,
      criadoPorFerramenta: mudancas.editadoPorFerramenta,
    });

    return linha;
  });
}

/** Busca uma Entidade por id, restrita ao dono. */
export async function obterEntidade(userId: string, id: number): Promise<Entidade | undefined> {
  const [linha] = await db
    .select()
    .from(entidades)
    .where(and(eq(entidades.id, id), eq(entidades.userId, userId)));
  return linha;
}

/** Lista as Entidades de um usuário, mais recentes primeiro. */
export async function listarEntidades(userId: string): Promise<Entidade[]> {
  return db
    .select()
    .from(entidades)
    .where(eq(entidades.userId, userId))
    .orderBy(desc(entidades.criadoEm));
}
