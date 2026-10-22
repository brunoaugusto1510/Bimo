import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "../db/cliente";
import { conceitosWiki, consumosWiki, notas, paginasWiki, trabalhosWiki } from "../db/schema";
import { ErroWiki, type PublicacaoWiki } from "./tipos";
import type { AutomacaoWiki, TrabalhoWiki } from "./automacao-tipos";
import { automacaoWikiDisponivel } from "./disponibilidade";
import { registrarAlteracaoWiki } from "./eventos-banco";

export type TransacaoWiki = Parameters<Parameters<typeof db.transaction>[0]>[0];
const colunas = { notaId: sql<string>`${trabalhosWiki.notaId}::text`, revisao: trabalhosWiki.revisao,
  geracao: trabalhosWiki.geracao, cursor: trabalhosWiki.cursor, posse: trabalhosWiki.posse, tentativas: trabalhosWiki.tentativas };
const idValido = (id: string) => /^[1-9]\d{0,18}$/.test(id) && BigInt(id) <= BigInt("9223372036854775807");


export function criarFilaWikiDoBanco(userId: string, publicar: (tx: TransacaoWiki, entrada: PublicacaoWiki) => Promise<string>): AutomacaoWiki {
  const doTrabalho = (id: string) => and(eq(trabalhosWiki.userId, userId), sql`${trabalhosWiki.notaId} = ${id}::bigint`);
  async function transacao<T>(executar: (tx: TransacaoWiki) => Promise<T>) {
    return db.transaction(async (tx) => {
      await tx.execute(sql`set local lock_timeout = '5s'`);
      await tx.execute(sql`set local statement_timeout = '15s'`);
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`bimo:notas:${userId.toLowerCase()}`}, 0))`);
      return executar(tx);
    });
  }
  const filtroDaPosse = (t: TrabalhoWiki) => and(doTrabalho(t.notaId), eq(trabalhosWiki.geracao, t.geracao),
    eq(trabalhosWiki.posse, t.posse), sql`${trabalhosWiki.posseAte} > clock_timestamp()`);
  async function exigirPosse(tx: TransacaoWiki, t: TrabalhoWiki) {
    const [atual] = await tx.select(colunas).from(trabalhosWiki).where(filtroDaPosse(t)).for("update");
    if (!atual) throw new ErroWiki("Trabalho superado.", 409);
  }
  const fila: AutomacaoWiki = {
    async solicitar(id) {
      if (!idValido(id)) return;
      await transacao(async (tx) => {
        const [nota] = await tx.select({ revisao: notas.revisao }).from(notas).where(and(eq(notas.userId, userId), sql`${notas.id} = ${id}::bigint`));
        if (nota) await registrarAlteracaoWiki(tx, userId, id, nota.revisao);
      });
    },
    async reconciliar(limite) {
      return transacao(async (tx) => {
        const linhas = await tx.select({ id: sql<string>`${notas.id}::text`, revisao: notas.revisao }).from(notas)
          .where(and(eq(notas.userId, userId), sql`not exists (select 1 from ${paginasWiki} p where p.user_id = ${userId}::uuid and p.nota_id = ${notas.id})`,
            sql`not exists (select 1 from ${trabalhosWiki} t where t.user_id = ${userId}::uuid and t.nota_id = ${notas.id} and t.revisao = ${notas.revisao})`))
          .orderBy(asc(notas.id)).limit(Math.max(1, Math.min(limite, 100)));
        for (const nota of linhas) await registrarAlteracaoWiki(tx, userId, nota.id, nota.revisao);
        return linhas.length;
      });
    },
    async reivindicar() {
      return transacao(async (tx) => {
        await tx.update(trabalhosWiki).set({ estado: "temporario" }).where(and(eq(trabalhosWiki.userId, userId), eq(trabalhosWiki.estado, "pendente"),
          sql`${trabalhosWiki.tentativas} >= 3`, sql`(${trabalhosWiki.posseAte} is null or ${trabalhosWiki.posseAte} <= clock_timestamp())`));
        const [proximo] = await tx.select(colunas).from(trabalhosWiki).where(and(eq(trabalhosWiki.userId, userId),
          eq(trabalhosWiki.estado, "pendente"), sql`${trabalhosWiki.disponivelEm} <= clock_timestamp()`,
          sql`(${trabalhosWiki.posseAte} is null or ${trabalhosWiki.posseAte} <= clock_timestamp())`,
          sql`not exists (select 1 from ${trabalhosWiki} c where c.user_id = ${userId}::uuid and c.estado = 'configuracao')`,
          // Um trabalho por dono de cada vez: o executor e as rodadas oportunistas não disputam o orçamento.
          sql`not exists (select 1 from ${trabalhosWiki} a where a.user_id = ${userId}::uuid and a.posse_ate > clock_timestamp())`))
          .orderBy(asc(trabalhosWiki.disponivelEm), asc(trabalhosWiki.notaId)).limit(1).for("update", { skipLocked: true });
        if (!proximo) return null;
        const [tomado] = await tx.update(trabalhosWiki).set({ posse: sql`gen_random_uuid()`, posseAte: sql`clock_timestamp() + interval '120 seconds'`,
          tentativas: sql`${trabalhosWiki.tentativas} + 1` }).where(doTrabalho(proximo.notaId)).returning(colunas);
        return tomado as TrabalhoWiki;
      });
    },
    async conceitos() {
      return db.select({ notaId: sql<string>`${conceitosWiki.notaId}::text`, chave: conceitosWiki.chave, aliases: conceitosWiki.aliases,
        protegida: sql<boolean>`(${conceitosWiki.protegida} or ${conceitosWiki.revisaoGerenciada} <> ${notas.revisao})`,
        origens: conceitosWiki.origens, revisaoGerenciada: conceitosWiki.revisaoGerenciada })
        .from(conceitosWiki).innerJoin(notas, and(eq(notas.userId, userId), eq(notas.id, conceitosWiki.notaId)))
        .where(eq(conceitosWiki.userId, userId)).orderBy(asc(conceitosWiki.notaId));
    },
    async cobertura() {
      const semRegistroAtual = sql`(${trabalhosWiki.notaId} is null or ${trabalhosWiki.revisao} <> ${notas.revisao})`;
      const [contagem] = await db.select({ elegiveis: sql<number>`count(*)::int`,
        naoRegistradas: sql<number>`count(*) filter (where ${semRegistroAtual})::int`,
        pendentes: sql<number>`count(*) filter (where ${semRegistroAtual} or ${trabalhosWiki.estado} = 'pendente')::int`,
        concluidos: sql<number>`count(*) filter (where not ${semRegistroAtual} and ${trabalhosWiki.estado} = 'concluido')::int`,
        impedidos: sql<number>`count(*) filter (where not ${semRegistroAtual} and ${trabalhosWiki.estado} not in ('pendente', 'concluido'))::int` })
        .from(notas).leftJoin(trabalhosWiki, and(eq(trabalhosWiki.userId, userId), eq(trabalhosWiki.notaId, notas.id)))
        .where(and(eq(notas.userId, userId), sql`not exists (select 1 from ${paginasWiki} p where p.user_id = ${userId}::uuid and p.nota_id = ${notas.id})`));
      return contagem;
    },
    async reservar(trabalho, quantidade, teto) {
      if (!Number.isSafeInteger(quantidade) || quantidade < 1 || !Number.isSafeInteger(teto) || teto < 1) throw new ErroWiki("Orçamento inválido.");
      return transacao(async (tx) => {
        await exigirPosse(tx, trabalho);
        const hoje = sql`(clock_timestamp() at time zone 'UTC')::date`;
        const [contagem] = await tx.select({ total: sql<number>`coalesce(sum(coalesce(${consumosWiki.utilizado}, ${consumosWiki.reservado})), 0)::int` })
          .from(consumosWiki).where(and(eq(consumosWiki.userId, userId), eq(consumosWiki.dia, hoje)));
        if (contagem.total + quantidade > teto) return null;
        const [reserva] = await tx.insert(consumosWiki).values({ userId, dia: hoje, notaId: trabalho.notaId,
          geracao: trabalho.geracao, reservado: quantidade, modelo: process.env.OPENAI_MODEL?.trim() || "gpt-6-luna" }).returning({ id: consumosWiki.id });
        return reserva.id;
      });
    },
    async confirmarConsumo(id, uso) {
      await db.update(consumosWiki).set(uso ? { utilizado: uso.entrada + uso.saida, estado: "confirmado" } : { estado: "incerto" })
        .where(and(eq(consumosWiki.userId, userId), eq(consumosWiki.id, id), sql`${consumosWiki.estado} <> 'confirmado'`));
    },
    async concluir(trabalho, publicacoes, cursor, avaliadas = []) {
      await transacao(async (tx) => {
        await exigirPosse(tx, trabalho);
        const [origem] = await tx.select({ revisao: notas.revisao }).from(notas)
          .where(and(eq(notas.userId, userId), sql`${notas.id} = ${trabalho.notaId}::bigint`)).for("share");
        if (!origem || origem.revisao !== trabalho.revisao) throw new ErroWiki("Origem superada.", 409);
        for (const p of publicacoes) {
          if (!p.conceito) throw new ErroWiki("Conceito ausente.", 422);
          const [existente] = await tx.select({ id: sql<string>`${conceitosWiki.notaId}::text`, protegida: conceitosWiki.protegida })
            .from(conceitosWiki).where(and(eq(conceitosWiki.userId, userId), eq(conceitosWiki.chave, p.conceito.chave)));
          if (existente && (existente.protegida || existente.id !== p.alvo?.id)) throw new ErroWiki("Conceito protegido ou existente.", 422);
          const id = await publicar(tx, p);
          const [nota] = await tx.select({ revisao: notas.revisao }).from(notas).where(and(eq(notas.userId, userId), sql`${notas.id} = ${id}::bigint`));
          const origens = Object.fromEntries(p.fontes.map((f) => [f.id, f.revisao]));
          await tx.insert(conceitosWiki).values({ userId, notaId: sql`${id}::bigint`, ...p.conceito, origens, revisaoGerenciada: nota.revisao })
            .onConflictDoUpdate({ target: conceitosWiki.notaId, set: { aliases: p.conceito.aliases, origens, revisaoGerenciada: nota.revisao },
              setWhere: and(eq(conceitosWiki.userId, userId), eq(conceitosWiki.protegida, false)) });
        }
        if (avaliadas.length) {
          // O modelo viu estas sínteses desatualizadas e não as mudou: a dependência passa a esta revisão.
          await tx.update(conceitosWiki).set({ origens: sql`jsonb_set(${conceitosWiki.origens}, array[${trabalho.notaId}]::text[], to_jsonb(${trabalho.revisao}::int))` })
            .where(and(eq(conceitosWiki.userId, userId), eq(conceitosWiki.protegida, false), sql`${conceitosWiki.origens} ? ${trabalho.notaId}`,
              sql`${conceitosWiki.notaId} in (${sql.join(avaliadas.filter(idValido).map((id) => sql`${id}::bigint`), sql`, `)})`));
        }
        // Só onda sem progresso conta como tentativa; ela também espera antes de voltar.
        // Sínteses novas não contam: só atualizar dependentes, avaliá-las ou avançar o cursor aproxima o fim.
        const progresso = publicacoes.some((p) => p.alvo) || avaliadas.length > 0 || cursor !== trabalho.cursor;
        const [conclusao] = await tx.update(trabalhosWiki).set({ cursor: cursor ?? trabalho.cursor, estado: cursor === null ? "concluido" : "pendente",
          posse: null, posseAte: null, tentativas: progresso ? 0 : trabalho.tentativas, ultimoErro: null,
          disponivelEm: progresso || cursor === null ? sql`clock_timestamp()` : sql`clock_timestamp() + make_interval(secs => ${30 * trabalho.tentativas})` })
          .where(filtroDaPosse(trabalho)).returning({ id: colunas.notaId });
        if (!conclusao) throw new ErroWiki("A posse expirou durante a publicação.", 409);
      });
    },
    async falhar(trabalho, motivo, erro) {
      await transacao(async (tx) => {
        await tx.update(trabalhosWiki).set({ posse: null, posseAte: null, ultimoErro: motivo === "orcamento" ? "orcamento" : erro?.slice(0, 100) ?? null,
          // Faltar orçamento não é falha do trabalho: a tentativa da reivindicação é devolvida.
          ...(motivo === "orcamento" ? { tentativas: sql`greatest(${trabalhosWiki.tentativas} - 1, 0)` } : {}),
          estado: motivo === "orcamento" || motivo === "temporario" && trabalho.tentativas < 3 ? "pendente" : motivo,
          disponivelEm: motivo === "orcamento" ? sql`date_trunc('day', clock_timestamp() at time zone 'UTC') at time zone 'UTC' + interval '1 day'`
            : sql`clock_timestamp() + make_interval(secs => ${30 * trabalho.tentativas})` }).where(filtroDaPosse(trabalho));
      });
    },
    async retomar() {
      await transacao(async (tx) => {
        await tx.update(trabalhosWiki).set({ estado: "pendente", tentativas: 0, posse: null, posseAte: null, disponivelEm: sql`clock_timestamp()` })
          .where(and(eq(trabalhosWiki.userId, userId), sql`(${trabalhosWiki.estado} in ('configuracao', 'temporario') or (${trabalhosWiki.estado} = 'revisar' and ${trabalhosWiki.ultimoErro} like 'ErroOpenAI:%'))`));
      });
    },
    async gerenciar(id, revisaoBase, gerenciada) {
      if (!idValido(id)) return "nao-encontrada";
      return transacao(async (tx) => {
        const [nota] = await tx.select({ revisao: notas.revisao }).from(notas).where(and(eq(notas.userId, userId), sql`${notas.id} = ${id}::bigint`)).for("update");
        const [conceito] = await tx.select({ origens: conceitosWiki.origens }).from(conceitosWiki)
          .where(and(eq(conceitosWiki.userId, userId), sql`${conceitosWiki.notaId} = ${id}::bigint`));
        if (!nota || !conceito) return "nao-encontrada" as const;
        if (nota.revisao !== revisaoBase) return "conflito" as const;
        await tx.update(conceitosWiki).set({ protegida: !gerenciada, revisaoGerenciada: nota.revisao })
          .where(and(eq(conceitosWiki.userId, userId), sql`${conceitosWiki.notaId} = ${id}::bigint`));
        if (gerenciada) for (const raiz of Object.keys(conceito.origens)) {
          const [origem] = await tx.select({ revisao: notas.revisao }).from(notas).where(and(eq(notas.userId, userId), sql`${notas.id} = ${raiz}::bigint`));
          if (!origem) continue;
          await registrarAlteracaoWiki(tx, userId, raiz, origem.revisao);
          await tx.update(trabalhosWiki).set({ geracao: sql`${trabalhosWiki.geracao} + 1`, cursor: 0, estado: "pendente",
            tentativas: 0, posse: null, posseAte: null, disponivelEm: sql`clock_timestamp()` }).where(doTrabalho(raiz));
        }
        return "ok" as const;
      });
    },
  };
  return comSondagem(fila);
}

/** Sem as tabelas no banco a fila fica vazia em vez de falhar: as notas continuam sendo gravadas e lidas. */
function comSondagem(fila: AutomacaoWiki): AutomacaoWiki {
  const disponivel = () => automacaoWikiDisponivel(db);
  const cobertura = { elegiveis: 0, naoRegistradas: 0, pendentes: 0, concluidos: 0, impedidos: 0 };
  return {
    solicitar: async (id) => { if (await disponivel()) await fila.solicitar(id); },
    reconciliar: async (limite) => (await disponivel() ? fila.reconciliar(limite) : 0),
    reivindicar: async () => (await disponivel() ? fila.reivindicar() : null),
    conceitos: async () => (await disponivel() ? fila.conceitos() : []),
    cobertura: async () => (await disponivel() ? fila.cobertura() : cobertura),
    reservar: async (trabalho, quantidade, teto) => (await disponivel() ? fila.reservar(trabalho, quantidade, teto) : null),
    confirmarConsumo: async (reserva, uso) => { if (await disponivel()) await fila.confirmarConsumo(reserva, uso); },
    concluir: async (trabalho, publicacoes, cursor, avaliadas) => { if (await disponivel()) await fila.concluir(trabalho, publicacoes, cursor, avaliadas); },
    falhar: async (trabalho, motivo, erro) => { if (await disponivel()) await fila.falhar(trabalho, motivo, erro); },
    retomar: async () => { if (await disponivel()) await fila.retomar(); },
    gerenciar: async (id, revisaoBase, gerenciada) => (await disponivel() ? fila.gerenciar(id, revisaoBase, gerenciada) : "nao-encontrada"),
  };
}
