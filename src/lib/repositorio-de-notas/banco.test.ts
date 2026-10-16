// @vitest-environment node
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { executarContratoDoRepositorio } from "./suite-de-contrato";
import type { NotaCompleta, RepositorioDeNotas } from "./tipos";

vi.mock("server-only", () => ({}));
const AUTOR = { criadoPor: "usuario" } as const;
const OPCOES = { revisaoBase: 1, autor: AUTOR };

describe.skipIf(!process.env.DATABASE_URL?.trim() || !process.env.SUPABASE_URL?.trim() || !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim())("banco", () => {
  let db: typeof import("../db/cliente").db;
  let schema: typeof import("../db/schema");
  let criar: typeof import("./banco").criarRepositorioDoBanco;
  let admin: ReturnType<typeof createClient>;
  let usuario: string;

  // O corpo do describe roda mesmo pulado: cliente e banco só entram no hook.
  beforeAll(async () => {
    ({ db } = await import("../db/cliente"));
    schema = await import("../db/schema");
    ({ criarRepositorioDoBanco: criar } = await import("./banco"));
    const { getConfigStorage } = await import("../supabase-storage");
    const { url, chaveServico } = getConfigStorage();
    admin = createClient(url, chaveServico);
    const { data, error } = await admin.auth.admin.createUser({
      email: `repositorio-${randomUUID()}@teste.bimo.local`, email_confirm: true,
    });
    if (error || !data.user) throw new Error(`Falha ao criar usuário efêmero: ${error?.message}`);
    usuario = data.user.id;
  }, 30000);

  afterAll(async () => {
    if (usuario) {
      const { error } = await admin.auth.admin.deleteUser(usuario);
      if (error) throw error;
    }
  }, 30000);

  async function fabrica(): Promise<RepositorioDeNotas> {
    await db.delete(schema.nos).where(eq(schema.nos.userId, usuario));
    return criar(usuario);
  }

  async function criarNota(repo: RepositorioDeNotas, titulo = "A", conteudo = ""): Promise<NotaCompleta> {
    const resultado = await repo.criarNota({ titulo, conteudo }, AUTOR);
    if (resultado.tipo !== "ok") throw new Error(`Falha ao criar nota: ${resultado.tipo}`);
    return resultado.nota;
  }

  async function versoes(id: string) {
    return db.select().from(schema.versoesNota).where(and(
      eq(schema.versoesNota.userId, usuario), eq(schema.versoesNota.notaId, Number(id)),
    )).orderBy(schema.versoesNota.id);
  }

  executarContratoDoRepositorio("banco", fabrica);

  it("isola leituras, busca e escritas de outro usuário", async () => {
    const repo = await fabrica();
    const nota = await criarNota(repo, "Privada", "segredo");
    const { data, error } = await admin.auth.admin.createUser({
      email: `isolamento-${randomUUID()}@teste.bimo.local`, email_confirm: true,
    });
    if (error || !data.user) throw new Error(`Falha ao criar segundo usuário: ${error?.message}`);
    const segundoUsuario = data.user.id;
    try {
      const outro = criar(segundoUsuario);
      const notaDoOutro = await criarNota(outro, "Privada", "[[Privada]]");
      const marca = await outro.marcaDeVersao();
      expect(await outro.obterNota(nota.id)).toBeNull();
      expect((await outro.listarResumos()).map((n) => n.id)).toEqual([notaDoOutro.id]);
      expect((await outro.listarComConteudo()).map((n) => n.id)).toEqual([notaDoOutro.id]);
      expect(await outro.buscarPorConteudo("segredo", 10)).toEqual([]);
      expect(await outro.atualizarNota(nota.id, { conteudo: "intruso" }, OPCOES)).toEqual({ tipo: "nao-encontrada" });
      expect(await outro.renomearNota(nota.id, "Intrusa", OPCOES)).toEqual({ tipo: "nao-encontrada" });
      expect(await repo.obterNota(notaDoOutro.id)).toBeNull();
      await repo.renomearNota(nota.id, "Nova", OPCOES);
      expect(await outro.marcaDeVersao()).toBe(marca);
      expect((await outro.obterNota(notaDoOutro.id))?.conteudo).toBe("[[Privada]]");
    } finally {
      const { error } = await admin.auth.admin.deleteUser(segundoUsuario);
      if (error) throw error;
    }
  });

  it("autosave reaproveita a sessão, checkpoint sem mudança a fecha e outro autor abre uma versão", async () => {
    const repo = await fabrica();
    const nota = await criarNota(repo);
    expect(await versoes(nota.id)).toMatchObject([{ sessaoAberta: false }]);
    await repo.atualizarNota(nota.id, { conteudo: "a" }, OPCOES);
    await repo.atualizarNota(nota.id, { conteudo: "ab" }, { ...OPCOES, revisaoBase: 2 });
    expect(await versoes(nota.id)).toHaveLength(2);
    await repo.atualizarNota(nota.id, {}, { ...OPCOES, revisaoBase: 3, checkpoint: true });
    expect((await versoes(nota.id))[1]).toMatchObject({ conteudo: "ab", sessaoAberta: false });
    await repo.atualizarNota(nota.id, { conteudo: "abc" }, { ...OPCOES, revisaoBase: 3 });
    await repo.atualizarNota(nota.id, { conteudo: "agente" }, {
      revisaoBase: 4, autor: { criadoPor: "agente", ferramenta: "editar_nota" },
    });
    const historico = await versoes(nota.id);
    expect(historico).toHaveLength(4);
    expect(historico[3]).toMatchObject({ criadoPor: "agente", criadoPorFerramenta: "editar_nota" });
  });

  it("duas edições do agente geram duas versões fechadas e encerram o autosave anterior", async () => {
    const repo = await fabrica();
    const nota = await criarNota(repo);
    await repo.atualizarNota(nota.id, { conteudo: "usuário" }, OPCOES);
    for (const revisao of [2, 3]) {
      await repo.atualizarNota(nota.id, { conteudo: `agente ${revisao}` }, {
        revisaoBase: revisao, autor: { criadoPor: "agente", ferramenta: "editar_nota" },
      });
    }
    const historico = await versoes(nota.id);
    expect(historico).toHaveLength(4);
    expect(historico.every((versao) => !versao.sessaoAberta)).toBe(true);
    expect(historico.slice(2).map((versao) => versao.conteudo)).toEqual(["agente 2", "agente 3"]);
  });

  it.each(["renomear", "mover"])("%s desfaz alvo, primeira reescrita e versões se a segunda falhar", async (operacao) => {
    const repo = await fabrica();
    const alvo = await criarNota(repo, "Antigo");
    await repo.atualizarNota(alvo.id, { pasta: "Pasta" }, OPCOES);
    const primeira = await criarNota(repo, "Primeira", "[[Pasta/Antigo]]");
    const segunda = await criarNota(repo, "Segunda", "[[Pasta/Antigo]]");
    const antes = await repo.listarComConteudo();
    const ids = [alvo.id, primeira.id, segunda.id];
    const historicos = await Promise.all(ids.map(versoes));
    const transacaoReal = db.transaction.bind(db);
    let gravacoes = 0;
    const espiao = vi.spyOn(db, "transaction").mockImplementationOnce((executar) => transacaoReal(async (tx) => {
      const atualizar = tx.update.bind(tx);
      vi.spyOn(tx, "update").mockImplementation((tabela) => {
        const consulta = atualizar(tabela);
        if (tabela === schema.notas && ++gravacoes === 3) {
          const definir = consulta.set.bind(consulta);
          vi.spyOn(consulta, "set").mockImplementationOnce((valores) => {
            const atualizacao = definir(valores);
            vi.spyOn(atualizacao, "returning").mockReturnValueOnce(Promise.resolve([]) as never);
            return atualizacao;
          });
        }
        return consulta;
      });
      return executar(tx);
    }));
    try {
      const opcoes = { revisaoBase: 2, autor: AUTOR };
      await expect(operacao === "renomear" ? repo.renomearNota(alvo.id, "Novo", opcoes)
        : repo.atualizarNota(alvo.id, { pasta: "Destino" }, opcoes)).rejects.toThrow(/Falha interna ao reescrever/);
    } finally {
      espiao.mockRestore();
    }
    expect(gravacoes).toBe(3);
    expect(await repo.listarComConteudo()).toEqual(antes);
    expect(await Promise.all(ids.map(versoes))).toEqual(historicos);
  });

  it("restauração pelo legado invalida a revisão do editor e fecha seu autosave", async () => {
    const repo = await fabrica();
    const nota = await criarNota(repo);
    await repo.atualizarNota(nota.id, { conteudo: "autosave" }, OPCOES);
    const { atualizarNota } = await import("../notas");
    await atualizarNota(usuario, Number(nota.id), { conteudo: "restaurado", editadoPor: "usuario" });
    expect(await repo.atualizarNota(nota.id, { conteudo: "editor antigo" }, { ...OPCOES, revisaoBase: 2 }))
      .toMatchObject({ tipo: "conflito", atual: { revisao: 3, conteudo: "restaurado" } });
    expect((await versoes(nota.id)).every((versao) => !versao.sessaoAberta)).toBe(true);
  });

  it("duas atualizações concorrentes produzem um ok e um conflito", async () => {
    const repo = await fabrica();
    const nota = await criarNota(repo);
    const resultados = await Promise.all([
      repo.atualizarNota(nota.id, { conteudo: "primeira" }, OPCOES),
      criar(usuario).atualizarNota(nota.id, { conteudo: "segunda" }, OPCOES),
    ]);
    expect(resultados.map((r) => r.tipo).sort()).toEqual(["conflito", "ok"]);
    expect(await versoes(nota.id)).toHaveLength(2);
  });

  it("títulos concorrentes são recusados sem deixar nós órfãos", async () => {
    const repo = await fabrica();
    const resultados = await Promise.all([
      repo.criarNota({ titulo: "Repetido" }, AUTOR),
      criar(usuario).criarNota({ titulo: "REPETIDO" }, AUTOR),
    ]);
    expect(resultados.map((r) => r.tipo).sort()).toEqual(["ok", "titulo-em-uso"]);
    expect(await db.select().from(schema.nos).where(eq(schema.nos.userId, usuario))).toHaveLength(1);
  });

  it("o índice barra duplicação com 23505 inclusive raiz null versus vazia", async () => {
    const repo = await fabrica();
    const existente = await criarNota(repo, "Resumo");
    await expect(db.transaction(async (tx) => {
      const [no] = await tx.insert(schema.nos).values({ tipo: "nota", userId: usuario }).returning();
      await tx.insert(schema.notas).values({
        id: no.id, userId: usuario, titulo: "RESUMO", pasta: "", conteudo: "", criadoPor: "usuario",
      });
    })).rejects.toMatchObject({ cause: { code: "23505" } });
    expect(await repo.criarNota({ titulo: "RESUMO" }, AUTOR))
      .toEqual({ tipo: "titulo-em-uso", idExistente: existente.id });
    expect(await db.select().from(schema.nos).where(eq(schema.nos.userId, usuario))).toHaveLength(1);
  });

  it("renomeação versiona todas as reescritas e a própria ligação uma vez", async () => {
    const repo = await fabrica();
    const alvo = await criarNota(repo, "Antigo", "[[Antigo]]");
    const outra = await criarNota(repo, "Outra", "[[Antigo|apelido]]");
    const resultado = await repo.renomearNota(alvo.id, "Novo", {
      revisaoBase: 1, autor: { criadoPor: "agente", ferramenta: "renomear_nota" },
    });
    expect(resultado).toMatchObject({ tipo: "ok", notasReescritas: 1, nota: { revisao: 2, conteudo: "[[Novo]]" } });
    for (const id of [alvo.id, outra.id]) {
      const historico = await versoes(id);
      expect(historico).toHaveLength(2);
      expect(historico[1]).toMatchObject({ criadoPorFerramenta: "renomear_nota", sessaoAberta: false });
    }
  });

  it("busca acentos, stemming, aspas e porcentagem sem erro nem vazamento", async () => {
    const repo = await fabrica();
    await criarNota(repo, "Café", "variáveis, códigos e reunião");
    for (const consulta of ["cafe", "CAFÉ", "variaveis", "codigo", '"reunião"', "reunião%", '"']) {
      const resultados = await repo.buscarPorConteudo(consulta, 10);
      if (consulta !== '"') expect(resultados.map((r) => r.titulo)).toEqual(["Café"]);
    }
    for (const consulta of ["", "%", "_", "\\", "***"]) {
      expect(await repo.buscarPorConteudo(consulta, 10)).toEqual([]);
    }
    expect(await repo.buscarPorConteudo("cafe", 0)).toEqual([]);
  });

  it("ids malformados e fora do intervalo não lançam erros", async () => {
    const repo = await fabrica();
    for (const id of ["abc", "1.2", "", "-1", "1e2", "9999999999999999999999999"]) {
      expect(await repo.obterNota(id)).toBeNull();
      expect(await repo.atualizarNota(id, {}, OPCOES)).toEqual({ tipo: "nao-encontrada" });
      expect(await repo.renomearNota(id, "Novo", OPCOES)).toEqual({ tipo: "nao-encontrada" });
    }
  });

  it("marca é compartilhada entre instâncias e muda a cada gravação rápida", async () => {
    const repo = await fabrica();
    const nota = await criarNota(repo);
    const marcas = [await repo.marcaDeVersao()];
    for (let revisao = 1; revisao <= 5; revisao++) {
      await repo.atualizarNota(nota.id, { conteudo: String(revisao) }, { ...OPCOES, revisaoBase: revisao });
      marcas.push(await repo.marcaDeVersao());
    }
    expect(new Set(marcas).size).toBe(6);
    expect(await criar(usuario).marcaDeVersao()).toBe(marcas[5]);
  });
});
