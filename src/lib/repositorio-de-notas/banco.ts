import "server-only";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { adotarGrafiaDaPasta, normalizarPasta } from "../caminho-da-nota";
import { db } from "../db/cliente";
import { nos, notas, versoesNota, paginasWiki, conceitosWiki } from "../db/schema";
import { conferirDestinos, conferirFontes, ErroWiki, type PublicacaoWiki } from "../wiki/tipos";
import { automacaoWikiHabilitada } from "../wiki/configuracao";
import { aquecerSondagemDaWiki, automacaoWikiDisponivel, sondarTabelasDaWiki } from "../wiki/disponibilidade";
import { acompanharOrganizacaoWiki, registrarAlteracaoWiki } from "../wiki/eventos-banco";
import { criarFilaWikiDoBanco } from "../wiki/fila-banco";
import { compactarFontes } from "../wiki/fontes";
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

  /**
   * O que uma gravação significa para a Wiki Viva: conteúdo novo (reprocessa a origem e protege a síntese editada),
   * organização (renomear, mover, etiquetar e reescrever ligações só acompanham a revisão) ou nada (a própria publicação).
   */
  type EfeitoNaWiki = "conteudo" | "organizacao" | "nenhum";
  async function acompanharWiki(tx: Transacao, nota: NotaCompleta, efeito: EfeitoNaWiki) {
    if (efeito === "nenhum" || !(await automacaoWikiDisponivel(tx))) return;
    const daSintese = and(eq(conceitosWiki.userId, userId), sql`${conceitosWiki.notaId} = ${nota.id}::bigint`);
    if (efeito === "conteudo") {
      await tx.update(conceitosWiki).set({ protegida: true }).where(daSintese);
      await registrarAlteracaoWiki(tx, userId, nota.id, nota.revisao);
      return;
    }
    // Só acompanha quem estava em dia: uma edição manual anterior continua detectável pela divergência.
    await tx.update(conceitosWiki).set({ revisaoGerenciada: nota.revisao })
      .where(and(daSintese, eq(conceitosWiki.protegida, false), eq(conceitosWiki.revisaoGerenciada, nota.revisao - 1)));
    await acompanharOrganizacaoWiki(tx, userId, nota.id, nota.revisao);
  }

  async function gravarNota(tx: Transacao, nota: NotaCompleta, autor: AutorDaEscrita, aberta: boolean, reaproveitar: boolean,
    efeito: EfeitoNaWiki) {
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
    await acompanharWiki(tx, atual, efeito);
    return { tipo: "ok" as const, nota: atual };
  }

  type Colisao = { pasta: string | null; titulo: string; ignorar?: string };
  async function escrever<T extends ResultadoDeEscrita | ResultadoDeRenomeacao>(
    executar: (tx: Transacao, colisao: Colisao) => Promise<T>,
  ): Promise<T | { tipo: "titulo-em-uso"; idExistente: string }> {
    const colisao: Colisao = { pasta: null, titulo: "" };
    await aquecerSondagemDaWiki(db);
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


  /** A revisão que a automação considera sua em cada síntese; vazio quando ela não está disponível. */
  async function gerenciasDasSinteses(id?: string) {
    const gerencias = new Map<string, { revisao: number; protegida: boolean }>();
    if (!(await automacaoWikiDisponivel(db))) return gerencias;
    const linhas = await db.select({ notaId: sql<string>`${conceitosWiki.notaId}::text`, revisao: conceitosWiki.revisaoGerenciada, protegida: conceitosWiki.protegida })
      .from(conceitosWiki).where(and(eq(conceitosWiki.userId, userId), id ? sql`${conceitosWiki.notaId} = ${id}::bigint` : undefined));
    for (const linha of linhas) gerencias.set(linha.notaId, { revisao: linha.revisao, protegida: linha.protegida });
    return gerencias;
  }

  async function publicarWiki(tx: Transacao, entrada: PublicacaoWiki, colisao: Colisao): Promise<ResultadoDeEscrita> {
    if (entrada.fontes.some((f) => !idValido(f.id)) || (entrada.alvo && !idValido(entrada.alvo.id))) throw new ErroWiki("Referência inválida.");
    const paginas = await tx.select({ id: sql<string>`${paginasWiki.notaId}::text` }).from(paginasWiki).where(eq(paginasWiki.userId, userId));
    // Trava também os escritores que não usam o advisory lock das notas.
    const fontes: (NotaCompleta | null)[] = [];
    for (const fonte of [...entrada.fontes].sort((a, b) => a.id.localeCompare(b.id))) {
      const [linha] = await tx.select(colunasDaNota).from(notas).where(daNota(fonte.id)).for("share");
      fontes.push(linha ? paraNota(linha) : null);
    }
    const porId = new Map(fontes.filter((f): f is NotaCompleta => f !== null).map((f) => [f.id, f]));
    conferirFontes(entrada.fontes, entrada.fontes.map((f) => porId.get(f.id) ?? null), new Set(paginas.map((p) => p.id)));
    // Trava as sínteses ligadas contra renomear e mover até o fim da transação, na mesma ordem das fontes (sem deadlock).
    if (entrada.destinos.some((d) => !idValido(d.id))) throw new ErroWiki("Referência inválida.");
    const destinos = new Map<string, NotaCompleta>();
    for (const destino of [...entrada.destinos].sort((a, b) => a.id.localeCompare(b.id))) {
      const [linha] = await tx.select(colunasDaNota).from(notas).where(daNota(destino.id)).for("share");
      if (linha) destinos.set(destino.id, paraNota(linha));
    }
    conferirDestinos(entrada.destinos, entrada.destinos.map((d) => destinos.get(d.id) ?? null), new Set(paginas.map((p) => p.id)));
    const autor = { criadoPor: "agente" as const, ferramenta: "compilar_wiki" };
    let nota: NotaCompleta;
    if (entrada.alvo) {
      const atual = await ler(entrada.alvo.id, tx);
      const [meta] = await tx.select({ revisao: paginasWiki.revisaoPublicada }).from(paginasWiki).where(and(eq(paginasWiki.userId, userId), sql`${paginasWiki.notaId} = ${entrada.alvo.id}::bigint`)).orderBy(desc(paginasWiki.revisaoPublicada)).limit(1);
      if (!meta || !atual) throw new ErroWiki("Essa nota não é uma página gerenciada da wiki.");
      if (atual.revisao !== entrada.alvo.revisao) throw new ErroWiki("A página foi alterada. Preserve a edição manual.", 409);
      const [conceito] = await tx.select({ protegida: conceitosWiki.protegida, revisao: conceitosWiki.revisaoGerenciada }).from(conceitosWiki)
        .where(and(eq(conceitosWiki.userId, userId), sql`${conceitosWiki.notaId} = ${atual.id}::bigint`));
      if (conceito?.protegida || atual.revisao !== (conceito?.revisao ?? meta.revisao)) throw new ErroWiki("A edição manual está protegida.", 409);
      const resultado = await gravarNota(tx, { ...atual, conteudo: entrada.conteudo }, autor, false, false, "nenhum");
      if (resultado.tipo !== "ok") return resultado;
      nota = resultado.nota;
    } else {
      const pastas = await tx.selectDistinct({ pasta: notas.pasta }).from(notas).where(doUsuario);
      const pasta = adotarGrafiaDaPasta(entrada.pasta, pastas.map((p) => p.pasta));
      Object.assign(colisao, { pasta, titulo: entrada.titulo });
      const existente = await tituloEmUso(tx, pasta, entrada.titulo);
      if (existente) return { tipo: "titulo-em-uso", idExistente: existente.id };
      const [no] = await tx.insert(nos).values({ tipo: "nota", userId }).returning({ id: sql<string>`${nos.id}::text` });
      const [linha] = await tx.insert(notas).values({ id: sql`${no.id}::bigint`, userId, titulo: entrada.titulo, pasta, conteudo: entrada.conteudo, tags: [], criadoPor: "agente", criadoPorFerramenta: "compilar_wiki" }).returning(colunasDaNota);
      nota = paraNota(linha); await versionar(tx, nota, autor, false);
    }
    await tx.insert(paginasWiki).values({ notaId: sql`${nota.id}::bigint`, userId, revisaoPublicada: nota.revisao, fontes: compactarFontes(entrada.fontes, entrada.afirmacoes), afirmacoes: entrada.afirmacoes,
      estrutura: { ligacoes: entrada.ligacoes, lacunas: entrada.lacunas, divergencias: entrada.divergencias ?? [], ...(entrada.editorial ? { editorial: entrada.editorial } : {}) } });
    return { tipo: "ok", nota };
  }

  return {
    capacidades: { escrita: true, datas: true },
    // Sem as migrações no banco, ligar a variável não derruba nada: a wiki fica vazia e as notas seguem funcionando.
    wiki: process.env.WIKI_VIVA_ATIVA === "1" ? {
      automacao: automacaoWikiHabilitada() ? criarFilaWikiDoBanco(userId, async (tx, entrada) => {
        const resultado = await publicarWiki(tx, entrada, { pasta: null, titulo: "" });
        if (resultado.tipo !== "ok") throw new ErroWiki("Conflito na publicação.", 409);
        return resultado.nota.id;
      }) : undefined,
      async listar() {
        if (!(await sondarTabelasDaWiki(db)).viva) return [];
        const paginas = await db.selectDistinctOn([paginasWiki.notaId], { notaId: sql<string>`${paginasWiki.notaId}::text`, revisaoPublicada: paginasWiki.revisaoPublicada, fontes: paginasWiki.fontes, afirmacoes: paginasWiki.afirmacoes, estrutura: paginasWiki.estrutura })
          .from(paginasWiki).where(eq(paginasWiki.userId, userId)).orderBy(paginasWiki.notaId, desc(paginasWiki.revisaoPublicada));
        const gerencias = await gerenciasDasSinteses();
        return paginas.map((pagina) => ({ ...pagina, ...(gerencias.has(pagina.notaId) ? { gerencia: gerencias.get(pagina.notaId) } : {}) }));
      },
      async obter(id) {
        if (!idValido(id) || !(await sondarTabelasDaWiki(db)).viva) return null;
        const [pagina] = await db.select({ notaId: sql<string>`${paginasWiki.notaId}::text`, revisaoPublicada: paginasWiki.revisaoPublicada, fontes: paginasWiki.fontes, afirmacoes: paginasWiki.afirmacoes, estrutura: paginasWiki.estrutura })
          .from(paginasWiki).where(and(eq(paginasWiki.userId, userId), sql`${paginasWiki.notaId} = ${id}::bigint`)).orderBy(desc(paginasWiki.revisaoPublicada)).limit(1);
        if (!pagina) return null;
        const gerencia = (await gerenciasDasSinteses(id)).get(id);
        return gerencia ? { ...pagina, gerencia } : pagina;
      },
    } : undefined,
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

    async buscarIdsPorConteudo(consulta, limite) {
      if (!/[\p{L}\p{N}]/u.test(consulta) || limite <= 0) return [];
      const quantidade = Number.isNaN(limite) ? 10 : Math.min(50, Math.floor(limite));
      const consultaTs = sql`websearch_to_tsquery('public.portugues_sem_acento', ${consulta})`;
      const linhas = await db.select({ id: sql<string>`${notas.id}::text` }).from(notas)
        .where(and(doUsuario, sql`${notas.vetorBusca} @@ ${consultaTs}`))
        .orderBy(sql`ts_rank(${notas.vetorBusca}, ${consultaTs}) desc`, asc(notas.id)).limit(quantidade);
      return linhas.map((linha) => linha.id);
    },

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
        await registrarAlteracaoWiki(tx, userId, nota.id, nota.revisao);
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
        }, autor, !checkpoint, true, nota.conteudo !== conteudo ? "conteudo" : "organizacao");
        if (resultado.tipo !== "ok") return resultado;
        for (const reescrita of reescritas.filter((r) => r.id !== id)) {
          const gravacao = await gravarNota(tx, { ...todas.find((n) => n.id === reescrita.id)!, conteudo: reescrita.conteudo }, autor, false, false, "organizacao");
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
        }, autor, false, false, "organizacao");
        if (resultado.tipo !== "ok") return resultado;
        let notasReescritas = 0;
        for (const reescrita of reescritas.filter((r) => r.id !== id)) {
          const gravacao = await gravarNota(tx, { ...todas.find((n) => n.id === reescrita.id)!, conteudo: reescrita.conteudo }, autor, false, false, "organizacao");
          if (gravacao.tipo !== "ok") throw new Error("Falha interna ao reescrever ligações da nota; transação cancelada.");
          notasReescritas++;
        }
        return { ...resultado, notasReescritas };
      });
    },
  };
}
