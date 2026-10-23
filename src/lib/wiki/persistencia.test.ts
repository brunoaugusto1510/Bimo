// @vitest-environment node
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { criarRepositorioDoBanco } from "../repositorio-de-notas/banco";
import { processarWiki } from "./automacao";
import type { ContextoWiki } from "./automacao-tipos";
import { evidenciasDaWiki } from "./consulta";
import { estadoDaPagina } from "./servico";

const sim = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("server-only", () => ({}));
vi.mock("../db/cliente", () => ({ get db() { return sim.db; } }));
const donoA = "00000000-0000-4000-8000-000000000001";
const donoB = "00000000-0000-4000-8000-000000000002";
const autor = { criadoPor: "usuario" as const };
let pg: PGlite;
const resposta = (c: ContextoWiki, alvoId: string | null = null) => ({ proposta: { propostas: [{ titulo: "Conhecimento combinado", alvoId,
  aliases: ["cópias"], afirmacoes: [{ texto: "As cópias precisam ser atualizadas.", natureza: "inferencia",
    evidencias: [{ fonteId: c.origem.id, citacao: c.trecho.texto }] }], lacunas: [] }] }, uso: { entrada: 100, saida: 100 } });
async function liberar() { await pg.exec("update trabalhos_wiki set disponivel_em = clock_timestamp() - interval '1 second'"); }

beforeAll(async () => {
  pg = new PGlite(); sim.db = drizzle(pg);
  // Somente o substrato anterior à wiki. As migrations da funcionalidade são executadas de verdade.
  await pg.exec(`create schema auth; create role authenticated;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create table auth.users (id uuid primary key);
    create table nos (id bigint generated always as identity primary key, tipo text not null, user_id uuid not null references auth.users(id));
    create text search configuration public.portugues_sem_acento (copy = pg_catalog.portuguese);
    create table notas (id bigint primary key references nos(id), user_id uuid not null references auth.users(id), titulo text not null,
      conteudo text not null, pasta text, tags text[], revisao integer not null default 1, criado_por text not null, criado_por_ferramenta text,
      criado_em timestamptz not null default now(), atualizado_em timestamptz not null default now(),
      vetor_busca tsvector generated always as (to_tsvector('public.portugues_sem_acento', titulo || ' ' || conteudo)) stored);
    create unique index notas_usuario_pasta_titulo_unico on notas (user_id, coalesce(pasta, ''), lower(titulo));
    create table versoes_nota (id bigint generated always as identity primary key, nota_id bigint references notas(id), user_id uuid not null,
      titulo text not null, conteudo text not null, pasta text, tags text[], criado_por text not null, criado_por_ferramenta text,
      sessao_aberta boolean not null default false, versionado_em timestamptz not null default now());`);
  for (const caminho of ["drizzle/0007_wiki_viva.sql", "drizzle/0008_wiki_automatica.sql", "drizzle/0009_wiki_ultimo_erro.sql", "drizzle/0010_wiki_estrutura.sql"]) await pg.exec(await readFile(caminho, "utf8"));
}, 30_000);
beforeEach(async () => {
  vi.stubEnv("WIKI_VIVA_ATIVA", "1"); vi.stubEnv("WIKI_AUTOMATICA_ATIVA", "1");
  await pg.exec("truncate table auth.users, nos, notas, versoes_nota, paginas_wiki, conceitos_wiki, trabalhos_wiki, consumos_wiki restart identity cascade");
  await pg.query("insert into auth.users values ($1), ($2)", [donoA, donoB]);
});
afterEach(() => vi.unstubAllEnvs());
afterAll(async () => { await pg?.close(); });

describe("persistência local da Wiki Viva", () => {
  it("salva evento e nota juntos e publica nota, evidências, conceito e conclusão atomicamente", async () => {
    const repo = criarRepositorioDoBanco(donoA);
    await repo.criarNota({ titulo: "Cache", conteudo: "O cache contém cópias." }, autor);
    expect((await pg.query("select * from trabalhos_wiki")).rows).toHaveLength(1);
    await liberar();
    expect((await processarWiki(repo, async (c) => resposta(c), { tetoDiario: 200_000 })).tipo).toBe("processado");
    expect((await repo.wiki!.listar())).toHaveLength(1);
    expect((await repo.wiki!.automacao!.conceitos())[0]).toMatchObject({ origens: { "1": 1 }, protegida: false });
    expect(await repo.wiki!.automacao!.cobertura()).toMatchObject({ elegiveis: 1, concluidos: 1, pendentes: 0 });
    expect((await pg.query("select estado, utilizado from consumos_wiki")).rows).toEqual([{ estado: "confirmado", utilizado: 200 }]);
    expect((await processarWiki(repo, vi.fn(), { tetoDiario: 200_000 })).tipo).toBe("ocioso");
  });
  it("falha nas evidências desfaz nota, histórico, conceito e conclusão, preservando consumo real", async () => {
    const repo = criarRepositorioDoBanco(donoA);
    await repo.criarNota({ titulo: "A", conteudo: "evidência" }, autor); await liberar();
    await pg.exec(`create function recusar_publicacao() returns trigger language plpgsql as $$ begin raise exception 'falha de teste'; end $$;
      create trigger falha_publicacao before insert on paginas_wiki for each row execute function recusar_publicacao()`);
    try {
      expect((await processarWiki(repo, async (c) => resposta(c), { tetoDiario: 200_000 })).tipo).toBe("adiado");
      expect(await repo.listarResumos()).toHaveLength(1);
      expect((await pg.query("select * from conceitos_wiki")).rows).toHaveLength(0);
      expect((await pg.query("select * from versoes_nota")).rows).toHaveLength(1);
      expect((await pg.query("select estado from trabalhos_wiki")).rows).toEqual([{ estado: "pendente" }]);
      expect((await pg.query("select utilizado from consumos_wiki")).rows).toEqual([{ utilizado: 200 }]);
    } finally { await pg.exec("drop trigger falha_publicacao on paginas_wiki; drop function recusar_publicacao()"); }
  });
  it("uma geração nova impede publicação da antiga e mantém o trabalho recente", async () => {
    const repo = criarRepositorioDoBanco(donoA);
    await repo.criarNota({ titulo: "A", conteudo: "antes" }, autor); await liberar();
    await processarWiki(repo, async (c) => {
      await repo.atualizarNota(c.origem.id, { conteudo: "depois" }, { revisaoBase: 1, autor });
      return resposta(c);
    }, { tetoDiario: 200_000 });
    expect(await repo.wiki!.listar()).toHaveLength(0);
    expect((await pg.query("select revisao, geracao, estado from trabalhos_wiki")).rows).toEqual([{ revisao: 2, geracao: 2, estado: "pendente" }]);
    await liberar(); await processarWiki(repo, async (c) => resposta(c), { tetoDiario: 200_000 });
    expect((await repo.wiki!.listar())[0].fontes[0].conteudo).toBe("depois");
  });
  it("reserva consumo sem corrida e mantém custo incerto mesmo após apagar a origem", async () => {
    const repo = criarRepositorioDoBanco(donoA);
    await repo.criarNota({ titulo: "A", conteudo: "texto" }, autor); await liberar();
    const fila = repo.wiki!.automacao!; const t = (await fila.reivindicar())!;
    const reservas = await Promise.all([fila.reservar(t, 100, 100), fila.reservar(t, 100, 100)]);
    expect(reservas.filter(Boolean)).toHaveLength(1);
    await fila.confirmarConsumo(reservas.find(Boolean)!, null);
    expect(await fila.reservar(t, 1, 100)).toBeNull();
    await pg.exec("delete from versoes_nota; delete from notas");
    expect((await pg.query("select reservado, estado from consumos_wiki")).rows).toEqual([{ reservado: 100, estado: "incerto" }]);
  });
  it("perder a posse impede conclusão, inclusive após outro executor retomar", async () => {
    const repo = criarRepositorioDoBanco(donoA);
    await repo.criarNota({ titulo: "A", conteudo: "texto" }, autor); await liberar();
    const fila = repo.wiki!.automacao!; const velho = (await fila.reivindicar())!;
    await pg.exec("update trabalhos_wiki set posse_ate = clock_timestamp() - interval '1 second'");
    const atual = (await fila.reivindicar())!; expect(atual.posse).not.toBe(velho.posse);
    await expect(fila.concluir(velho, [], null)).rejects.toThrow();
    await fila.concluir(atual, [], null);
    expect((await fila.cobertura()).concluidos).toBe(1);
  });
  it("isola usuários nas consultas, constraints e políticas RLS", async () => {
    const a = criarRepositorioDoBanco(donoA); const b = criarRepositorioDoBanco(donoB);
    await a.criarNota({ titulo: "Privada", conteudo: "privado" }, autor);
    await b.wiki!.automacao!.solicitar("1");
    expect(await b.wiki!.automacao!.reivindicar()).toBeNull();
    expect(await b.wiki!.automacao!.cobertura()).toMatchObject({ elegiveis: 0, pendentes: 0 });
    await expect(pg.query("insert into trabalhos_wiki (user_id, nota_id, revisao) values ($1, 1, 1)", [donoB])).rejects.toThrow();
    await pg.exec("grant usage on schema public, auth to authenticated; grant select, insert, update, delete on trabalhos_wiki, consumos_wiki, conceitos_wiki to authenticated; set role authenticated");
    try {
      await pg.query("select set_config('request.jwt.claim.sub', $1, false)", [donoB]);
      expect((await pg.query("select * from trabalhos_wiki")).rows).toHaveLength(0);
      await pg.query("select set_config('request.jwt.claim.sub', $1, false)", [donoA]);
      expect((await pg.query("select * from trabalhos_wiki")).rows).toHaveLength(1);
      await expect(pg.query("insert into consumos_wiki (user_id, dia, nota_id, geracao, reservado, modelo) values ($1, current_date, '1', 1, 100, 'simulado')", [donoA])).rejects.toThrow();
      expect((await pg.query("delete from trabalhos_wiki returning nota_id")).rows).toHaveLength(0);
    } finally { await pg.exec("reset role"); }
  });
  it("edição manual protege a síntese; renomear uma nota gerenciada preserva a identidade", async () => {
    const repo = criarRepositorioDoBanco(donoA);
    await repo.criarNota({ titulo: "A", conteudo: "texto" }, autor); await liberar();
    await processarWiki(repo, async (c) => resposta(c), { tetoDiario: 200_000 });
    const [pagina] = await repo.wiki!.listar();
    await repo.renomearNota(pagina.notaId, "Outro nome", { revisaoBase: 1, autor });
    expect((await repo.wiki!.automacao!.conceitos())[0].protegida).toBe(false);
    await repo.atualizarNota(pagina.notaId, { conteudo: "minha edição" }, { revisaoBase: 2, autor });
    expect((await repo.wiki!.automacao!.conceitos())[0].protegida).toBe(true);
    await repo.criarNota({ titulo: "B", conteudo: "novidade" }, autor); await liberar();
    await processarWiki(repo, async (c) => resposta(c, pagina.notaId), { tetoDiario: 200_000 });
    expect((await repo.obterNota(pagina.notaId))?.conteudo).toBe("minha edição");
    expect(await repo.wiki!.automacao!.gerenciar(pagina.notaId, 1, true)).toBe("conflito");
    expect(await criarRepositorioDoBanco(donoB).wiki!.automacao!.gerenciar(pagina.notaId, 3, true)).toBe("nao-encontrada");
    expect(await repo.wiki!.automacao!.gerenciar(pagina.notaId, 3, true)).toBe("ok");
    expect((await repo.wiki!.automacao!.conceitos())[0].protegida).toBe(false);
  });
  it("preserva edição feita com automação desligada depois de reativar", async () => {
    const repo = criarRepositorioDoBanco(donoA);
    await repo.criarNota({ titulo: "A", conteudo: "evidência" }, autor); await liberar();
    await processarWiki(repo, async (c) => resposta(c), { tetoDiario: 200_000 });
    const [p] = await repo.wiki!.listar();
    vi.stubEnv("WIKI_AUTOMATICA_ATIVA", "0");
    await repo.atualizarNota(p.notaId, { conteudo: "edição durante a pausa" }, { revisaoBase: 1, autor });
    vi.stubEnv("WIKI_AUTOMATICA_ATIVA", "1");
    expect((await repo.wiki!.automacao!.conceitos())[0].protegida).toBe(true);
    await repo.criarNota({ titulo: "B", conteudo: "outra evidência" }, autor); await liberar();
    await processarWiki(repo, async (c) => resposta(c, p.notaId), { tetoDiario: 200_000 });
    expect((await repo.obterNota(p.notaId))?.conteudo).toBe("edição durante a pausa");
  });
  it("falha ao registrar o evento desfaz também a criação da nota e seu histórico", async () => {
    await pg.exec(`create function recusar_evento() returns trigger language plpgsql as $$ begin raise exception 'falha de teste'; end $$;
      create trigger falha_evento before insert on trabalhos_wiki for each row execute function recusar_evento()`);
    try {
      await expect(criarRepositorioDoBanco(donoA).criarNota({ titulo: "A", conteudo: "texto" }, autor)).rejects.toThrow();
      expect((await pg.query("select * from notas")).rows).toHaveLength(0);
      expect((await pg.query("select * from versoes_nota")).rows).toHaveLength(0);
      expect((await pg.query("select * from nos")).rows).toHaveLength(0);
    } finally { await pg.exec("drop trigger falha_evento on trabalhos_wiki; drop function recusar_evento()"); }
  });
  it("posse que expira durante a publicação também desfaz notas e evidências", async () => {
    const repo = criarRepositorioDoBanco(donoA);
    await repo.criarNota({ titulo: "A", conteudo: "texto" }, autor); await liberar();
    await pg.exec(`create function expirar_posse() returns trigger language plpgsql as $$ begin
        update trabalhos_wiki set posse_ate = clock_timestamp() - interval '1 second' where user_id = new.user_id;
        return new; end $$;
      create trigger expirar_ao_publicar before insert on paginas_wiki for each row execute function expirar_posse()`);
    try {
      expect((await processarWiki(repo, async (c) => resposta(c), { tetoDiario: 200_000 })).tipo).toBe("adiado");
      expect(await repo.listarResumos()).toHaveLength(1);
      expect(await repo.wiki!.listar()).toHaveLength(0);
      expect((await pg.query("select * from versoes_nota")).rows).toHaveLength(1);
    } finally { await pg.exec("drop trigger expirar_ao_publicar on paginas_wiki; drop function expirar_posse()"); }
  });
});

describe("busca só de ids no Postgres", () => {
  it("devolve os mesmos acertos da busca completa, na mesma ordem, só do dono, e respeita o limite", async () => {
    const repo = criarRepositorioDoBanco(donoA);
    await repo.criarNota({ titulo: "Quórum", conteudo: "O quórum decide a eleição do líder." }, autor);
    await repo.criarNota({ titulo: "Raft", conteudo: "No Raft o quórum de maioria elege o líder; quórum, quórum." }, autor);
    await repo.criarNota({ titulo: "Outra", conteudo: "nada a ver" }, autor);
    await criarRepositorioDoBanco(donoB).criarNota({ titulo: "De outro dono", conteudo: "quórum alheio" }, autor);
    const completos = await repo.buscarPorConteudo("quórum", 10);
    const ids = await repo.buscarIdsPorConteudo("quórum", 10);
    expect(ids).toEqual(completos.map((r) => r.id));
    expect(ids).toHaveLength(2);
    expect(await repo.buscarIdsPorConteudo("quórum", 1)).toHaveLength(1);
    expect(await repo.buscarIdsPorConteudo("inexistente", 5)).toEqual([]);
    expect(await repo.buscarIdsPorConteudo("!!!", 5)).toEqual([]);
    expect(await repo.buscarIdsPorConteudo("quórum", 0)).toEqual([]);
  });
});

describe("afirmações com id no Postgres", () => {
  const afirmacao = (texto: string, fonteId: string, citacao: string) => ({ texto, natureza: "explicita" as const, evidencias: [{ fonteId, citacao }] });
  const proposta = (extras: object) => ({ titulo: "Regras do pedido", alvoId: null, aliases: [], lacunas: [], afirmacoes: [], substituicoes: [], retiradas: [], ...extras });

  it("os ids atravessam o jsonb, e retirar ou substituir por id publica uma versão nova sem a afirmação antiga", async () => {
    const repo = criarRepositorioDoBanco(donoA);
    await repo.criarNota({ titulo: "Limites", conteudo: "O limite de itens por pedido é 10. O prazo de entrega é de 5 dias." }, autor); await liberar();
    await processarWiki(repo, async (c) => ({ proposta: { propostas: [proposta({ afirmacoes: [
      afirmacao("Limite de 10 itens", c.origem.id, "O limite de itens por pedido é 10"), afirmacao("Prazo de 5 dias", c.origem.id, "O prazo de entrega é de 5 dias")] })] }, uso: { entrada: 1, saida: 1 } }), { tetoDiario: 200_000 });
    const [pagina] = await repo.wiki!.listar();
    const [idLimite, idPrazo] = pagina.afirmacoes.map((a) => a.id);
    expect([idLimite, idPrazo].every((id) => /^a[0-9a-f]{10}$/.test(id))).toBe(true);
    expect((await repo.wiki!.obter(pagina.notaId))!.afirmacoes.map((a) => a.id)).toEqual([idLimite, idPrazo]);

    const origem = await repo.criarNota({ titulo: "Atualização", conteudo: "A partir de março o limite de itens por pedido passou a ser 20." }, autor);
    await liberar();
    await processarWiki(repo, async (c) => ({ proposta: { propostas: [proposta({ alvoId: pagina.notaId,
      substituicoes: [{ id: idLimite, afirmacao: afirmacao("Limite de 20 itens", c.origem.id, "o limite de itens por pedido passou a ser 20") }] })] }, uso: { entrada: 1, saida: 1 } }), { tetoDiario: 200_000 });
    const [depois] = await repo.wiki!.listar();
    expect(origem.tipo).toBe("ok");
    expect(depois.afirmacoes.map((a) => a.texto)).toEqual(["Prazo de 5 dias", "Limite de 20 itens"]);
    expect(depois.afirmacoes[0].id).toBe(idPrazo);
    expect((await repo.obterNota(pagina.notaId))!.conteudo).not.toContain("Limite de 10 itens");
    expect((await pg.query("select count(*)::int as n from paginas_wiki where nota_id = $1", [pagina.notaId])).rows).toEqual([{ n: 2 }]);
  });
});

describe("ligações e perguntas em aberto no Postgres", () => {
  it("a estrutura atravessa o jsonb e uma síntese enriquecida mantém as ligações e as perguntas", async () => {
    const repo = criarRepositorioDoBanco(donoA);
    await repo.criarNota({ titulo: "Pão", conteudo: "A massa fermenta devagar na geladeira por doze horas." }, autor); await liberar();
    await processarWiki(repo, async (c) => ({ proposta: { propostas: [{ titulo: "Fermentação lenta", alvoId: null, aliases: [], lacunas: [],
      afirmacoes: [{ texto: "Fermenta devagar", natureza: "explicita", evidencias: [{ fonteId: c.origem.id, citacao: "A massa fermenta devagar na geladeira" }] }] }] }, uso: { entrada: 1, saida: 1 } }), { tetoDiario: 200_000 });
    const [fermentacao] = await repo.wiki!.listar();
    expect(fermentacao.estrutura).toEqual({ ligacoes: [], lacunas: [] });

    await repo.criarNota({ titulo: "Diário", conteudo: "Hoje percebi que paciência serve tanto para o pão quanto para os livros." }, autor); await liberar();
    await processarWiki(repo, async (c) => ({ proposta: { propostas: [{ titulo: "Paciência como método", alvoId: null, aliases: [], lacunas: ["Quanto é paciência demais?"],
      ligacoes: [fermentacao.notaId, "9999"],
      afirmacoes: [{ texto: "Paciência liga as duas coisas", natureza: "inferencia", evidencias: [{ fonteId: c.origem.id, citacao: "paciência serve tanto para o pão quanto para os livros" }] }] }] }, uso: { entrada: 1, saida: 1 } }), { tetoDiario: 200_000 });
    const paciencia = (await repo.wiki!.listar()).find((p) => p.notaId !== fermentacao.notaId)!;
    expect(paciencia.estrutura).toEqual({ ligacoes: [fermentacao.notaId], lacunas: ["Quanto é paciência demais?"] });
    expect((await repo.obterNota(paciencia.notaId))!.conteudo).toContain("[[Fermentação lenta]]");
    expect((await pg.query("select estrutura from paginas_wiki where nota_id = $1", [paciencia.notaId])).rows).toEqual([{ estrutura: paciencia.estrutura }]);

    await repo.criarNota({ titulo: "Corrida", conteudo: "A paciência também vale para a corrida de domingo, sempre devagar." }, autor); await liberar();
    await processarWiki(repo, async (c) => ({ proposta: { propostas: [{ titulo: "Paciência como método", alvoId: paciencia.notaId, aliases: [], lacunas: [],
      afirmacoes: [{ texto: "Vale para a corrida", natureza: "explicita", evidencias: [{ fonteId: c.origem.id, citacao: "paciência também vale para a corrida de domingo" }] }] }] }, uso: { entrada: 1, saida: 1 } }), { tetoDiario: 200_000 });
    expect((await repo.wiki!.obter(paciencia.notaId))!.estrutura).toEqual(paciencia.estrutura);
  });

  it("renomear a síntese ligada entre o preparo e a publicação recusa a publicação em vez de gravar o link velho", async () => {
    const repo = criarRepositorioDoBanco(donoA);
    await repo.criarNota({ titulo: "Pão", conteudo: "A massa fermenta devagar na geladeira por doze horas." }, autor); await liberar();
    await processarWiki(repo, async (c) => ({ proposta: { propostas: [{ titulo: "Fermentação lenta", alvoId: null, aliases: [], lacunas: [],
      afirmacoes: [{ texto: "Fermenta devagar", natureza: "explicita", evidencias: [{ fonteId: c.origem.id, citacao: "A massa fermenta devagar na geladeira" }] }] }] }, uso: { entrada: 1, saida: 1 } }), { tetoDiario: 200_000 });
    const [fermentacao] = await repo.wiki!.listar();
    await repo.criarNota({ titulo: "Diário", conteudo: "Hoje percebi que paciência serve tanto para o pão quanto para os livros." }, autor); await liberar();
    const fila = repo.wiki!.automacao!;
    const concluir = fila.concluir.bind(fila);
    const espiao = vi.spyOn(fila, "concluir").mockImplementationOnce(async (...args) => {
      const ligada = (await repo.obterNota(fermentacao.notaId))!;
      await repo.renomearNota(fermentacao.notaId, "Fermentação lenta e fria", { revisaoBase: ligada.revisao, autor: { criadoPor: "usuario" } });
      return concluir(...args);
    });
    const gerar = async (c: ContextoWiki) => ({ proposta: { propostas: [{ titulo: "Paciência como método", alvoId: null, aliases: [], lacunas: [], ligacoes: [fermentacao.notaId],
      afirmacoes: [{ texto: "Paciência liga as duas coisas", natureza: "inferencia" as const, evidencias: [{ fonteId: c.origem.id, citacao: "paciência serve tanto para o pão quanto para os livros" }] }] }] }, uso: { entrada: 1, saida: 1 } });
    await processarWiki(repo, gerar, { tetoDiario: 200_000 });
    espiao.mockRestore();
    expect(await repo.wiki!.listar()).toHaveLength(1);
  });
});

describe("regressões da fila no Postgres", () => {
  const vazio = { proposta: { propostas: [] }, uso: { entrada: 10, saida: 10 } };
  const trabalho = async () => (await pg.query("select revisao, geracao, estado, tentativas, ultimo_erro, cursor from trabalhos_wiki")).rows[0] as
    { revisao: number; geracao: number; estado: string; tentativas: number; ultimo_erro: string | null; cursor: number };

  it("orçamento negado por dias seguidos não gasta tentativas nem trava o trabalho", async () => {
    const repo = criarRepositorioDoBanco(donoA);
    await repo.criarNota({ titulo: "A", conteudo: "TCP garante entrega ordenada." }, autor);
    for (let dia = 0; dia < 4; dia++) {
      await liberar();
      expect((await processarWiki(repo, vi.fn(), { tetoDiario: 1 })).tipo).toBe("orcamento");
      // O trabalho só volta no próximo dia UTC, não na próxima rodada.
      expect((await pg.query("select disponivel_em > clock_timestamp() + interval '1 minute' as adiado, disponivel_em <= clock_timestamp() + interval '1 day' as ate_amanha from trabalhos_wiki")).rows[0])
        .toEqual({ adiado: true, ate_amanha: true });
    }
    expect(await trabalho()).toMatchObject({ estado: "pendente", tentativas: 0, ultimo_erro: "orcamento" });
    await liberar();
    expect((await processarWiki(repo, async () => vazio, { tetoDiario: 200_000 })).tipo).toBe("processado");
    expect(await trabalho()).toMatchObject({ estado: "concluido", ultimo_erro: null });
  });

  it("um dono tem no máximo um trabalho em posse por vez", async () => {
    const repo = criarRepositorioDoBanco(donoA); const fila = repo.wiki!.automacao!;
    await repo.criarNota({ titulo: "A", conteudo: "Primeira." }, autor);
    await repo.criarNota({ titulo: "B", conteudo: "Segunda." }, autor);
    await liberar();
    expect(await fila.reivindicar()).not.toBeNull();
    expect(await fila.reivindicar()).toBeNull();
    // Outro dono não é bloqueado por essa posse.
    const outro = criarRepositorioDoBanco(donoB);
    await outro.criarNota({ titulo: "C", conteudo: "Terceira." }, autor); await liberar();
    expect(await outro.wiki!.automacao!.reivindicar()).not.toBeNull();
  });

  it("guarda só a categoria da falha, nunca o texto da nota ou do erro", async () => {
    const registro = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const repo = criarRepositorioDoBanco(donoA);
      await repo.criarNota({ titulo: "A", conteudo: "conteúdo confidencial" }, autor); await liberar();
      await processarWiki(repo, async (c) => { throw Object.assign(new Error(`falhou com ${c.trecho.texto}`), { status: 429 }); }, { tetoDiario: 200_000 });
      expect(await trabalho()).toMatchObject({ estado: "pendente", ultimo_erro: "Error:429" });
      expect(JSON.stringify(registro.mock.calls)).not.toContain("confidencial");
    } finally { registro.mockRestore(); }
  });

  it("dependente que o modelo viu e não mudou fica avaliada e conclui a origem", async () => {
    const repo = criarRepositorioDoBanco(donoA);
    await repo.criarNota({ titulo: "Cache", conteudo: "O cache guarda cópias locais." }, autor); await liberar();
    await processarWiki(repo, async (c) => resposta(c), { tetoDiario: 200_000 });
    expect((await repo.wiki!.automacao!.conceitos())[0].origens).toEqual({ "1": 1 });
    await repo.atualizarNota("1", { conteudo: "O cache guarda cópias remotas." }, { revisaoBase: 1, autor }); await liberar();
    const gerar = vi.fn(async () => vazio);
    expect((await processarWiki(repo, gerar, { tetoDiario: 200_000 })).tipo).toBe("processado");
    expect((await repo.wiki!.automacao!.conceitos())[0].origens).toEqual({ "1": 2 });
    expect(await trabalho()).toMatchObject({ estado: "concluido", tentativas: 0 });
    await liberar();
    expect((await processarWiki(repo, gerar, { tetoDiario: 200_000 })).tipo).toBe("ocioso");
    expect(gerar).toHaveBeenCalledTimes(1);
  });

  it("renomear e mover uma nota acompanham a revisão sem reprocessá-la", async () => {
    const repo = criarRepositorioDoBanco(donoA);
    await repo.criarNota({ titulo: "A", conteudo: "TCP garante entrega ordenada." }, autor); await liberar();
    await processarWiki(repo, async () => vazio, { tetoDiario: 200_000 });
    await repo.renomearNota("1", "B", { revisaoBase: 1, autor });
    await repo.atualizarNota("1", { pasta: "Redes" }, { revisaoBase: 2, autor });
    expect(await trabalho()).toMatchObject({ revisao: 3, geracao: 1, estado: "concluido" });
    await liberar();
    expect((await processarWiki(repo, vi.fn(), { tetoDiario: 200_000 })).tipo).toBe("ocioso");
    // Conteúdo novo, ao contrário, abre uma geração nova.
    await repo.atualizarNota("1", { conteudo: "TCP garante entrega ordenada de bytes." }, { revisaoBase: 3, autor });
    expect(await trabalho()).toMatchObject({ revisao: 4, geracao: 2, estado: "pendente" });
  });

  it("renomear ou mover uma síntese não a faz parecer editada; editar o texto sim", async () => {
    const repo = criarRepositorioDoBanco(donoA);
    await repo.criarNota({ titulo: "A", conteudo: "evidência" }, autor); await liberar();
    await processarWiki(repo, async (c) => resposta(c), { tetoDiario: 200_000 });
    const [pagina] = await repo.wiki!.listar();
    await repo.renomearNota(pagina.notaId, "Outro nome", { revisaoBase: 1, autor });
    await repo.atualizarNota(pagina.notaId, { pasta: "Conceitos" }, { revisaoBase: 2, autor });
    expect((await repo.wiki!.obter(pagina.notaId))?.gerencia).toEqual({ revisao: 3, protegida: false });
    expect(await estadoDaPagina(repo, (await repo.wiki!.obter(pagina.notaId))!)).toBe("atualizada");
    await repo.atualizarNota(pagina.notaId, { conteudo: "minha versão" }, { revisaoBase: 3, autor });
    expect(await estadoDaPagina(repo, (await repo.wiki!.obter(pagina.notaId))!)).toBe("edicao_manual");
  });

  it("renomear uma nota linkada por uma origem mantém a síntese atual e suas evidências", async () => {
    const repo = criarRepositorioDoBanco(donoA);
    await repo.criarNota({ titulo: "TCP", conteudo: "TCP garante entrega ordenada. Ver [[UDP]]." }, autor);
    await repo.criarNota({ titulo: "UDP", conteudo: "UDP é mais leve." }, autor); await liberar();
    await processarWiki(repo, async (c) => ({ proposta: { propostas: [{ titulo: "Transporte", alvoId: null, aliases: [], lacunas: [],
      afirmacoes: [{ texto: "Ordem.", natureza: "explicita", evidencias: [{ fonteId: c.origem.id, citacao: "TCP garante entrega ordenada" }] }] }] }, uso: { entrada: 1, saida: 1 } }), { tetoDiario: 200_000 });
    const [pagina] = await repo.wiki!.listar();
    await repo.renomearNota("2", "Datagramas", { revisaoBase: 1, autor });
    expect((await repo.obterNota("1"))?.conteudo).toContain("[[Datagramas]]");
    expect(await estadoDaPagina(repo, (await repo.wiki!.obter(pagina.notaId))!)).toBe("atualizada");
    expect((await evidenciasDaWiki(repo, pagina.notaId))?.afirmacoes).toHaveLength(1);
  });

  it("reescrever uma ligação não apaga a proteção de uma edição manual feita com a automação desligada", async () => {
    const repo = criarRepositorioDoBanco(donoA);
    await repo.criarNota({ titulo: "A", conteudo: "evidência" }, autor); await liberar();
    await processarWiki(repo, async (c) => resposta(c), { tetoDiario: 200_000 });
    const [pagina] = await repo.wiki!.listar();
    vi.stubEnv("WIKI_AUTOMATICA_ATIVA", "0");
    await repo.atualizarNota(pagina.notaId, { conteudo: "edição durante a pausa [[A]]" }, { revisaoBase: 1, autor });
    vi.stubEnv("WIKI_AUTOMATICA_ATIVA", "1");
    // Renomear a origem reescreve a ligação dentro da síntese editada.
    await repo.renomearNota("1", "A2", { revisaoBase: 1, autor });
    expect((await repo.obterNota(pagina.notaId))?.conteudo).toContain("[[A2]]");
    expect((await repo.wiki!.automacao!.conceitos())[0].protegida).toBe(true);
    expect(await estadoDaPagina(repo, (await repo.wiki!.obter(pagina.notaId))!)).toBe("edicao_manual");
  });
});
