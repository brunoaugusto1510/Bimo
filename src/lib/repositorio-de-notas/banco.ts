import "server-only";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { adotarGrafiaDaPasta, normalizarPasta } from "../caminho-da-nota";
import { db } from "../db/cliente";
import { nos, notas, versoesNota } from "../db/schema";
import { CONFIGURACAO_PADRAO } from "../fisica-do-grafo";
import { planejarMudanca, planejarRenomeacao } from "./renomeacao";
import { REGEX_UUID } from "./config";
import type {
  AutorDaEscrita, NotaCompleta, RepositorioDeNotas, ResultadoDeEscrita,
  ResultadoDeRenomeacao, ResumoDeNota,
} from "./tipos";

type Transacao = Parameters<Parameters<typeof db.transaction>[0]>[0];
const TEMPO_LIMITE_DE_LOCK = "5s";
const TEMPO_LIMITE_DE_INSTRUCAO = "15s";
const colunasDoResumo = {
  id: sql<string>`${notas.id}::text`, titulo: notas.titulo, pasta: notas.pasta,
  tags: notas.tags, revisao: notas.revisao, criadoEm: notas.criadoEm, atualizadoEm: notas.atualizadoEm,
};
const colunasDaNota = { ...colunasDoResumo, conteudo: notas.conteudo };
type LinhaDoResumo = Omit<ResumoDeNota, "tags" | "criadoEm" | "atualizadoEm"> & {
  tags: string[] | null; criadoEm: Date; atualizadoEm: Date;
};

function paraResumo(linha: LinhaDoResumo): ResumoDeNota {
  return { ...linha, tags: linha.tags ?? [], criadoEm: linha.criadoEm.toISOString(), atualizadoEm: linha.atualizadoEm.toISOString() };
}

function paraNota(linha: LinhaDoResumo & { conteudo: string }): NotaCompleta {
  return { ...paraResumo(linha), conteudo: linha.conteudo };
}

function idValido(id: string): boolean {
  return /^[1-9]\d{0,18}$/.test(id) && BigInt(id) <= BigInt("9223372036854775807");
}

function eTituloEmUso(erro: unknown): boolean {
  if (!erro || typeof erro !== "object") return false;
  if ("code" in erro && erro.code === "23505" &&
    "constraint_name" in erro && erro.constraint_name === "notas_usuario_pasta_titulo_unico") return true;
  return "cause" in erro && eTituloEmUso(erro.cause);
}

/** O filtro do dono é obrigatório mesmo conectando como proprietário do banco. */
export function criarRepositorioDoBanco(userId: string): RepositorioDeNotas {
  if (!REGEX_UUID.test(userId)) throw new Error("O UUID do usuário é inválido para o repositório de notas.");
  const doUsuario = eq(notas.userId, userId);
  const daNota = (id: string) => and(doUsuario, sql`${notas.id} = ${id}::bigint`);

  async function ler(id: string, conexao: Transacao | typeof db = db): Promise<NotaCompleta | null> {
    const [linha] = await conexao.select(colunasDaNota).from(notas).where(daNota(id));
    return linha ? paraNota(linha) : null;
  }

  async function listar(conexao: Transacao | typeof db): Promise<NotaCompleta[]> {
    const consulta = conexao.select(colunasDaNota).from(notas).where(doUsuario).orderBy(asc(notas.id));
    return (await consulta).map(paraNota);
  }

  async function tituloEmUso(conexao: Transacao | typeof db, pasta: string | null, titulo: string, ignorar?: string) {
    const [existente] = await conexao.select({ id: colunasDoResumo.id }).from(notas).where(and(
      doUsuario, sql`coalesce(${notas.pasta}, '') = ${pasta ?? ""}`,
      sql`lower(${notas.titulo}) = lower(${titulo})`,
      ignorar ? sql`${notas.id} <> ${ignorar}::bigint` : undefined,
    )).limit(1);
    return existente;
  }

  async function versionar(tx: Transacao, nota: NotaCompleta, autor: AutorDaEscrita, aberta: boolean, reaproveitar = false) {
    const valores = {
      titulo: nota.titulo, conteudo: nota.conteudo, pasta: nota.pasta, tags: nota.tags,
      criadoPor: autor.criadoPor, criadoPorFerramenta: autor.ferramenta ?? null,
      sessaoAberta: aberta && autor.criadoPor === "usuario", versionadoEm: sql`clock_timestamp()`,
    };
    const filtro = and(eq(versoesNota.userId, userId), sql`${versoesNota.notaId} = ${nota.id}::bigint`);
    if (reaproveitar && autor.criadoPor === "usuario") {
      const [ultima] = await tx.select({
        id: sql<string>`${versoesNota.id}::text`, sessaoAberta: versoesNota.sessaoAberta, criadoPor: versoesNota.criadoPor,
      }).from(versoesNota).where(filtro).orderBy(desc(versoesNota.id)).limit(1);
      if (ultima?.sessaoAberta && ultima.criadoPor === autor.criadoPor) {
        await tx.update(versoesNota).set(valores).where(and(filtro, sql`${versoesNota.id} = ${ultima.id}::bigint`));
        return;
      }
    }
    await tx.update(versoesNota).set({ sessaoAberta: false }).where(and(filtro, eq(versoesNota.sessaoAberta, true)));
    await tx.insert(versoesNota).values({ ...valores, notaId: sql`${nota.id}::bigint`, userId });
  }

  async function gravarNota(tx: Transacao, nota: NotaCompleta, autor: AutorDaEscrita, aberta: boolean, reaproveitar = false) {
    const [linha] = await tx.update(notas).set({
      titulo: nota.titulo, conteudo: nota.conteudo, pasta: nota.pasta, tags: nota.tags,
      revisao: sql`${notas.revisao} + 1`, atualizadoEm: sql`clock_timestamp()`,
    }).where(and(daNota(nota.id), eq(notas.revisao, nota.revisao))).returning(colunasDaNota);
    if (!linha) {
      const atual = await ler(nota.id, tx);
      return atual ? { tipo: "conflito" as const, atual } : { tipo: "nao-encontrada" as const };
    }
    const atual = paraNota(linha);
    await versionar(tx, atual, autor, aberta, reaproveitar);
    return { tipo: "ok" as const, nota: atual };
  }

  type Colisao = { pasta: string | null; titulo: string; ignorar?: string };
  async function escrever<T extends ResultadoDeEscrita | ResultadoDeRenomeacao>(
    executar: (tx: Transacao, colisao: Colisao) => Promise<T>,
  ): Promise<T | { tipo: "titulo-em-uso"; idExistente: string }> {
    const colisao: Colisao = { pasta: null, titulo: "" };
    try {
      return await db.transaction(async (tx) => {
        await tx.execute(sql.raw(`set local lock_timeout = '${TEMPO_LIMITE_DE_LOCK}'`));
        await tx.execute(sql.raw(`set local statement_timeout = '${TEMPO_LIMITE_DE_INSTRUCAO}'`));
        // Renomear/mover planeja sobre todas as notas. Serializar as escritas do dono
        // evita perder edições nas reescritas e faz a adoção de pastas ser consistente.
        await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`bimo:notas:${userId.toLowerCase()}`}, 0))`);
        return executar(tx, colisao);
      });
    } catch (erro) {
      if (!eTituloEmUso(erro)) throw erro;
      // Depois do rollback, o próprio Postgres usa a mesma comparação do índice.
      const existente = await tituloEmUso(db, colisao.pasta, colisao.titulo, colisao.ignorar);
      if (!existente) throw erro;
      return { tipo: "titulo-em-uso", idExistente: existente.id };
    }
  }

  return {
    capacidades: { escrita: true, datas: true },
    async obterAviso() { return undefined; },
    async obterConfiguracaoDoGrafo() { return CONFIGURACAO_PADRAO; },

    async marcaDeVersao() {
      const [marca] = await db.select({
        valor: sql<string>`concat(count(*), ':', coalesce(sum(${notas.revisao}), 0), ':', coalesce(max(${notas.atualizadoEm})::text, ''))`,
      }).from(notas).where(doUsuario);
      return marca.valor;
    },
    async listarResumos() {
      return (await db.select(colunasDoResumo).from(notas).where(doUsuario).orderBy(asc(notas.id))).map(paraResumo);
    },
    async listarComConteudo() { return listar(db); },
    async obterNota(id) { return idValido(id) ? ler(id) : null; },

    async buscarPorConteudo(consulta, limite) {
      if (!/[\p{L}\p{N}]/u.test(consulta) || limite <= 0) return [];
      const quantidade = Number.isNaN(limite) ? 10 : Math.min(50, Math.floor(limite));
      const consultaTs = sql`websearch_to_tsquery('public.portugues_sem_acento', ${consulta})`;
      const candidatas = db.select({
        id: notas.id, titulo: notas.titulo, pasta: notas.pasta, conteudo: notas.conteudo,
        pontuacao: sql<number>`ts_rank(${notas.vetorBusca}, ${consultaTs})`.as("pontuacao"),
      }).from(notas).where(and(doUsuario, sql`${notas.vetorBusca} @@ ${consultaTs}`))
        .orderBy(sql`pontuacao desc`, asc(notas.id)).limit(quantidade).as("candidatas");
      const linhas = await db.select({
        id: sql<string>`${candidatas.id}::text`, titulo: candidatas.titulo, pasta: candidatas.pasta,
        trecho: sql<string>`ts_headline('public.portugues_sem_acento', ${candidatas.conteudo}, ${consultaTs}, 'StartSel=**, StopSel=**')`,
      }).from(candidatas).orderBy(desc(candidatas.pontuacao), asc(candidatas.id));
      return linhas;
    },

    async criarNota(entrada, autor) {
      return escrever<ResultadoDeEscrita>(async (tx, colisao) => {
        const pastas = await tx.selectDistinct({ pasta: notas.pasta }).from(notas).where(doUsuario);
        const pasta = adotarGrafiaDaPasta(normalizarPasta(entrada.pasta), pastas.map((nota) => nota.pasta));
        Object.assign(colisao, { pasta, titulo: entrada.titulo });
        const existente = await tituloEmUso(tx, pasta, entrada.titulo);
        if (existente) return { tipo: "titulo-em-uso", idExistente: existente.id };
        const [no] = await tx.insert(nos).values({ tipo: "nota", userId }).returning({ id: sql<string>`${nos.id}::text` });
        const [linha] = await tx.insert(notas).values({
          id: sql`${no.id}::bigint`, userId, titulo: entrada.titulo, pasta,
          conteudo: entrada.conteudo ?? "", tags: entrada.tags ?? [], revisao: 1,
          criadoPor: autor.criadoPor, criadoPorFerramenta: autor.ferramenta,
          criadoEm: sql`clock_timestamp()`, atualizadoEm: sql`clock_timestamp()`,
        }).returning(colunasDaNota);
        const nota = paraNota(linha);
        await versionar(tx, nota, autor, false);
        return { tipo: "ok", nota };
      });
    },

    async atualizarNota(id, mudancas, { revisaoBase, autor, checkpoint }) {
      if (!idValido(id)) return { tipo: "nao-encontrada" };
      return escrever<ResultadoDeEscrita>(async (tx, colisao) => {
        const nota = await ler(id, tx);
        if (!nota) return { tipo: "nao-encontrada" };
        if (nota.revisao !== revisaoBase) return { tipo: "conflito", atual: nota };
        const pasta = mudancas.pasta === undefined ? nota.pasta : adotarGrafiaDaPasta(
          normalizarPasta(mudancas.pasta),
          (await tx.selectDistinct({ pasta: notas.pasta }).from(notas).where(and(doUsuario, sql`${notas.id} <> ${id}::bigint`))).map((n) => n.pasta),
        );
        const conteudo = mudancas.conteudo ?? nota.conteudo;
        const tags = mudancas.tags ?? nota.tags;
        const mudou = pasta !== nota.pasta || conteudo !== nota.conteudo || tags.join("\n") !== nota.tags.join("\n");
        if (!mudou) {
          if (checkpoint) {
            await tx.update(versoesNota).set({ sessaoAberta: false }).where(and(
              eq(versoesNota.userId, userId), sql`${versoesNota.notaId} = ${id}::bigint`, eq(versoesNota.sessaoAberta, true),
            ));
          }
          return { tipo: "ok", nota };
        }
        Object.assign(colisao, { pasta, titulo: nota.titulo, ignorar: id });
        const existente = pasta === nota.pasta ? undefined : await tituloEmUso(tx, pasta, nota.titulo, id);
        if (existente) return { tipo: "titulo-em-uso", idExistente: existente.id };
        const todas = pasta === nota.pasta ? [] : await listar(tx);
        const reescritas = pasta === nota.pasta ? [] : planejarMudanca(
          todas.map((outra) => outra.id === id ? { ...outra, conteudo } : outra), id, { pasta },
        );
        // Primeiro o CAS da nota alvo: nenhuma reescrita deve preceder uma recusa.
        const resultado = await gravarNota(tx, {
          ...nota, pasta, tags, conteudo: reescritas.find((r) => r.id === id)?.conteudo ?? conteudo,
        }, autor, !checkpoint, true);
        if (resultado.tipo !== "ok") return resultado;
        for (const reescrita of reescritas.filter((r) => r.id !== id)) {
          const gravacao = await gravarNota(tx, { ...todas.find((n) => n.id === reescrita.id)!, conteudo: reescrita.conteudo }, autor, false);
          if (gravacao.tipo !== "ok") throw new Error("Falha interna ao reescrever ligações da nota; transação cancelada.");
        }
        return {
          ...resultado,
          ...(pasta !== nota.pasta ? { notasReescritas: reescritas.filter((r) => r.id !== id).length } : {}),
        };
      });
    },

    async renomearNota(id, novoTitulo, { revisaoBase, autor }) {
      if (!idValido(id)) return { tipo: "nao-encontrada" };
      return escrever<ResultadoDeRenomeacao>(async (tx, colisao) => {
        const todas = await listar(tx);
        const nota = todas.find((nota) => nota.id === id);
        if (!nota) return { tipo: "nao-encontrada" };
        if (nota.revisao !== revisaoBase) return { tipo: "conflito", atual: nota };
        if (nota.titulo === novoTitulo) return { tipo: "ok", nota, notasReescritas: 0 };
        Object.assign(colisao, { pasta: nota.pasta, titulo: novoTitulo, ignorar: id });
        const existente = await tituloEmUso(tx, nota.pasta, novoTitulo, id);
        if (existente) return { tipo: "titulo-em-uso", idExistente: existente.id };
        const reescritas = planejarRenomeacao(todas, id, novoTitulo);
        const resultado = await gravarNota(tx, {
          ...nota, titulo: novoTitulo, conteudo: reescritas.find((r) => r.id === id)?.conteudo ?? nota.conteudo,
        }, autor, false);
        if (resultado.tipo !== "ok") return resultado;
        let notasReescritas = 0;
        for (const reescrita of reescritas.filter((r) => r.id !== id)) {
          const gravacao = await gravarNota(tx, { ...todas.find((n) => n.id === reescrita.id)!, conteudo: reescrita.conteudo }, autor, false);
          if (gravacao.tipo !== "ok") throw new Error("Falha interna ao reescrever ligações da nota; transação cancelada.");
          notasReescritas++;
        }
        return { ...resultado, notasReescritas };
      });
    },
  };
}
