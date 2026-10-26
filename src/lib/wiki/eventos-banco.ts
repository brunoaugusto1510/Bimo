import { and, eq, sql } from "drizzle-orm";
import { conceitosWiki, paginasWiki, trabalhosWiki } from "../db/schema";
import { ESTABILIDADE_DA_WIKI_SEGUNDOS } from "./configuracao";
import { automacaoWikiDisponivel } from "./disponibilidade";
import type { TransacaoWiki } from "./fila-banco";

/** Chamado dentro da transação que grava conteúdo novo; este registro é também a outbox. */
export async function registrarAlteracaoWiki(tx: TransacaoWiki, userId: string, notaId: string, revisao: number) {
  if (!(await automacaoWikiDisponivel(tx))) return;
  await tx.execute(sql`insert into ${trabalhosWiki} (user_id, nota_id, revisao, disponivel_em)
    select ${userId}::uuid, ${notaId}::bigint, ${revisao}, clock_timestamp() + make_interval(secs => ${ESTABILIDADE_DA_WIKI_SEGUNDOS})
    where not exists (select 1 from ${paginasWiki} p where p.user_id = ${userId}::uuid and p.nota_id = ${notaId}::bigint)
    on conflict (user_id, nota_id) do update set revisao = excluded.revisao, geracao = trabalhos_wiki.geracao + 1,
      cursor = 0, estado = case when trabalhos_wiki.estado = 'configuracao' then 'configuracao' else 'pendente' end,
      tentativas = 0, posse = null, posse_ate = null, disponivel_em = excluded.disponivel_em
    where trabalhos_wiki.user_id = ${userId}::uuid and trabalhos_wiki.revisao <> excluded.revisao`);
}

/**
 * Renomear, mover, etiquetar ou reescrever ligações não muda o que a nota diz: o trabalho só acompanha
 * a revisão, sem nova chamada ao modelo. Um trabalho já atrasado fica como está; a reconciliação o retoma.
 */
export async function acompanharOrganizacaoWiki(tx: TransacaoWiki, userId: string, notaId: string, revisao: number) {
  if (!(await automacaoWikiDisponivel(tx))) return;
  await tx.update(trabalhosWiki).set({ revisao })
    .where(and(eq(trabalhosWiki.userId, userId), sql`${trabalhosWiki.notaId} = ${notaId}::bigint`, eq(trabalhosWiki.revisao, revisao - 1)));
  // As sínteses que se apoiavam na revisão anterior continuam em dia: sem isso renomear uma origem as deixaria "reconsolidando"
  // para sempre, e a origem não roda de novo. Quem estava defasado de verdade (origem editada e ainda não lida) não é tocado.
  await tx.update(conceitosWiki).set({ origens: sql`jsonb_set(${conceitosWiki.origens}, array[${notaId}]::text[], to_jsonb(${revisao}::int))` })
    .where(and(eq(conceitosWiki.userId, userId), sql`${conceitosWiki.origens} ? ${notaId}`, sql`(${conceitosWiki.origens} ->> ${notaId})::int = ${revisao - 1}`));
}
