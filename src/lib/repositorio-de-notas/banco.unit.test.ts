// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";

const simulacao = vi.hoisted(() => ({
  db: { select: vi.fn(), selectDistinct: vi.fn(), insert: vi.fn(), update: vi.fn(), execute: vi.fn(), transaction: vi.fn() },
}));
vi.mock("server-only", () => ({}));
vi.mock("../db/cliente", () => ({ db: simulacao.db }));
import { criarRepositorioDoBanco } from "./banco";

const USUARIO = "4c6831c0-fdc6-4074-a832-5465b0cbb953";
const AUTOR = { criadoPor: "usuario" } as const;
const momento = new Date("2026-10-16T12:00:00Z");
const linha = {
  id: "7", titulo: "A", pasta: null, tags: null, conteudo: "texto",
  revisao: 1, criadoEm: momento, atualizadoEm: momento,
};

/** Respostas de SQL simuladas só nas bordas; o contrato continua sendo contra Postgres real. */
function consulta(resultado: unknown, erro?: Error) {
  const promessa = () => erro ? Promise.reject(erro) : Promise.resolve(resultado);
  const encadeada = {
    from: vi.fn(() => encadeada), where: vi.fn((filtro: SQL | undefined) => { void filtro; return encadeada; }),
    orderBy: vi.fn(() => encadeada), limit: vi.fn(() => encadeada),
    for: vi.fn(() => encadeada), values: vi.fn((valores: unknown) => { void valores; return encadeada; }),
    set: vi.fn((valores: unknown) => { void valores; return encadeada; }), returning: vi.fn(() => encadeada),
    then: (sucesso: (valor: unknown) => unknown, falha: (erro: unknown) => unknown) => promessa().then(sucesso, falha),
  };
  return encadeada;
}

beforeEach(() => {
  vi.resetAllMocks();
  simulacao.db.transaction.mockImplementation(async (executar) => executar(simulacao.db));
  simulacao.db.execute.mockResolvedValue([]);
});

describe("banco — bordas sem rede", () => {
  it("converte 23505 encapsulado após rollback e usa a comparação do índice para achar o id", async () => {
    const erro = new Error("consulta recusada", { cause: { code: "23505", constraint_name: "notas_usuario_pasta_titulo_unico" } });
    const colisao = consulta([{ id: "8" }]);
    simulacao.db.selectDistinct.mockReturnValueOnce(consulta([]));
    simulacao.db.select.mockReturnValueOnce(consulta([])).mockReturnValueOnce(colisao);
    simulacao.db.insert.mockReturnValueOnce(consulta([{ id: "9" }])).mockReturnValueOnce(consulta([], erro));

    expect(await criarRepositorioDoBanco(USUARIO).criarNota({ titulo: "RESUMO" }, AUTOR))
      .toEqual({ tipo: "titulo-em-uso", idExistente: "8" });
    const filtro = new PgDialect().sqlToQuery(colisao.where.mock.calls[0][0] as SQL);
    expect(filtro.sql).toContain('"notas"."user_id"');
    expect(filtro.sql).toContain("lower(");
    expect(filtro.params).toContain(USUARIO);
    expect(filtro.params).toContain("RESUMO");
  });

  it("propaga erros inesperados sem consultar um suposto título em uso", async () => {
    const erro = new Error("conexão indisponível");
    simulacao.db.execute.mockRejectedValueOnce(erro);
    await expect(criarRepositorioDoBanco(USUARIO).criarNota({ titulo: "A" }, AUTOR)).rejects.toBe(erro);
    expect(simulacao.db.select).not.toHaveBeenCalled();
  });

  it("propaga 23505 quando não há nota correspondente, sem inventar um id", async () => {
    const erro = Object.assign(new Error("colisão sem correspondente"), {
      code: "23505", constraint_name: "notas_usuario_pasta_titulo_unico",
    });
    simulacao.db.selectDistinct.mockReturnValueOnce(consulta([]));
    const busca = consulta([]);
    simulacao.db.select.mockReturnValueOnce(consulta([])).mockReturnValueOnce(busca);
    simulacao.db.insert.mockReturnValueOnce(consulta([{ id: "9" }])).mockReturnValueOnce(consulta([], erro));
    await expect(criarRepositorioDoBanco(USUARIO).criarNota({ titulo: "Resumo", pasta: "Projetos" }, AUTOR)).rejects.toBe(erro);
    expect(new PgDialect().sqlToQuery(busca.where.mock.calls[0][0] as SQL).params).toEqual([USUARIO, "Projetos", "Resumo"]);
  });

  it("propaga 23505 de outra restrição mesmo encapsulado", async () => {
    const erro = new Error("outra chave", { cause: { code: "23505", constraint_name: "nos_pkey" } });
    simulacao.db.execute.mockRejectedValueOnce(erro);
    await expect(criarRepositorioDoBanco(USUARIO).criarNota({ titulo: "A" }, AUTOR)).rejects.toBe(erro);
    expect(simulacao.db.select).not.toHaveBeenCalled();
  });

  it("valida o UUID do dono antes de executar SQL", () => {
    for (const id of ["", "user-1", "4c6831c0-fdc6-4074-a832-5465b0cbb95z"]) {
      expect(() => criarRepositorioDoBanco(id)).toThrow(/UUID.*usuário/);
    }
    expect(simulacao.db.transaction).not.toHaveBeenCalled();
  });

  it("configura os timeouts antes do advisory lock e de qualquer consulta", async () => {
    simulacao.db.select.mockReturnValueOnce(consulta([]));
    await criarRepositorioDoBanco(USUARIO).atualizarNota("7", {}, { revisaoBase: 1, autor: AUTOR });
    expect(simulacao.db.execute.mock.calls.map(([comando]) => new PgDialect().sqlToQuery(comando).sql)).toEqual([
      "set local lock_timeout = '5s'", "set local statement_timeout = '15s'",
      "select pg_advisory_xact_lock(hashtextextended($1, 0))",
    ]);
    expect(simulacao.db.execute.mock.invocationCallOrder[2]).toBeLessThan(simulacao.db.select.mock.invocationCallOrder[0]);
  });

  it.each(["55P03", "57014"])("propaga timeout %s no advisory lock", async (code) => {
    const erro = Object.assign(new Error("tempo esgotado"), { code });
    simulacao.db.execute.mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockRejectedValueOnce(erro);
    await expect(criarRepositorioDoBanco(USUARIO).atualizarNota("7", {}, { revisaoBase: 1, autor: AUTOR })).rejects.toBe(erro);
    expect(simulacao.db.select).not.toHaveBeenCalled();
  });

  it("autosave lê somente a nota alvo e a última versão, sem tocar outras notas", async () => {
    const alvo = consulta([linha]);
    const ultima = consulta([{ id: "3", sessaoAberta: true, criadoPor: "usuario" }]);
    simulacao.db.select.mockReturnValueOnce(alvo).mockReturnValueOnce(ultima);
    const gravacao = consulta([{ ...linha, revisao: 2, conteudo: "novo" }]);
    const versao = consulta([]);
    simulacao.db.update.mockReturnValueOnce(gravacao).mockReturnValueOnce(versao);
    expect(await criarRepositorioDoBanco(USUARIO).atualizarNota("7", { conteudo: "novo" }, { revisaoBase: 1, autor: AUTOR }))
      .toMatchObject({ tipo: "ok", nota: { revisao: 2 } });
    expect(simulacao.db.select).toHaveBeenCalledTimes(2);
    expect(simulacao.db.selectDistinct).not.toHaveBeenCalled();
    expect(new PgDialect().sqlToQuery(alvo.where.mock.calls[0][0] as SQL).params).toEqual([USUARIO, "7"]);
    expect(alvo.for).not.toHaveBeenCalled();
    expect(simulacao.db.update).toHaveBeenCalledTimes(2);
    const valoresNota = gravacao.set.mock.calls[0][0] as unknown as { atualizadoEm: SQL };
    const valoresVersao = versao.set.mock.calls[0][0] as unknown as { versionadoEm: SQL };
    expect(new PgDialect().sqlToQuery(valoresNota.atualizadoEm).sql).toBe("clock_timestamp()");
    expect(new PgDialect().sqlToQuery(valoresVersao.versionadoEm).sql).toBe("clock_timestamp()");
  });

  it("criação consulta apenas pastas distintas e o título, usando o relógio do banco", async () => {
    const pastas = consulta([{ pasta: "Projetos" }]);
    simulacao.db.selectDistinct.mockReturnValueOnce(pastas);
    simulacao.db.select.mockReturnValueOnce(consulta([]));
    const insercao = consulta([linha]);
    const versao = consulta([]);
    simulacao.db.insert.mockReturnValueOnce(consulta([{ id: "7" }])).mockReturnValueOnce(insercao).mockReturnValueOnce(versao);
    simulacao.db.update.mockReturnValueOnce(consulta([]));
    expect(await criarRepositorioDoBanco(USUARIO).criarNota({ titulo: "A", pasta: "projetos" }, AUTOR)).toMatchObject({ tipo: "ok" });
    expect(simulacao.db.select).toHaveBeenCalledTimes(1);
    expect(Object.keys(simulacao.db.selectDistinct.mock.calls[0][0])).toEqual(["pasta"]);
    const valores = insercao.values.mock.calls[0][0] as unknown as { pasta: string; criadoEm: SQL; atualizadoEm: SQL };
    expect(valores.pasta).toBe("Projetos");
    for (const data of [valores.criadoEm, valores.atualizadoEm]) {
      expect(new PgDialect().sqlToQuery(data).sql).toBe("clock_timestamp()");
    }
    const snapshot = versao.values.mock.calls[0][0] as unknown as { versionadoEm: SQL };
    expect(new PgDialect().sqlToQuery(snapshot.versionadoEm).sql).toBe("clock_timestamp()");
  });

  it("duas edições do usuário sem checkpoint mantêm uma única versão de autosave", async () => {
    const repo = criarRepositorioDoBanco(USUARIO);
    for (const revisao of [1, 2]) {
      simulacao.db.select.mockReturnValueOnce(consulta([{ ...linha, revisao }]))
        .mockReturnValueOnce(consulta([{ id: "3", sessaoAberta: revisao === 2, criadoPor: "usuario" }]));
      simulacao.db.update.mockReturnValueOnce(consulta([{ ...linha, revisao: revisao + 1 }])).mockReturnValueOnce(consulta([]));
      simulacao.db.insert.mockReturnValueOnce(consulta([]));
      expect(await repo.atualizarNota("7", { conteudo: `usuário ${revisao}` }, { revisaoBase: revisao, autor: AUTOR }))
        .toMatchObject({ tipo: "ok" });
    }
    expect(simulacao.db.insert).toHaveBeenCalledTimes(1);
    expect(simulacao.db.update.mock.results[3].value.set).toHaveBeenCalledWith(expect.objectContaining({ sessaoAberta: true }));
  });

  it("edições seguidas do agente criam versões fechadas sem reaproveitar a sessão", async () => {
    const repo = criarRepositorioDoBanco(USUARIO);
    for (const revisao of [1, 2]) {
      simulacao.db.select.mockReturnValueOnce(consulta([{ ...linha, revisao }]));
      simulacao.db.update.mockReturnValueOnce(consulta([{ ...linha, revisao: revisao + 1 }])).mockReturnValueOnce(consulta([]));
      simulacao.db.insert.mockReturnValueOnce(consulta([]));
      expect(await repo.atualizarNota("7", { conteudo: `agente ${revisao}` }, {
        revisaoBase: revisao, autor: { criadoPor: "agente" },
      })).toMatchObject({ tipo: "ok" });
    }
    expect(simulacao.db.select).toHaveBeenCalledTimes(2);
    expect(simulacao.db.insert).toHaveBeenCalledTimes(2);
    for (const chamada of simulacao.db.insert.mock.results) {
      expect(chamada.value.values.mock.calls[0][0]).toMatchObject({ sessaoAberta: false, criadoPor: "agente" });
    }
    expect(simulacao.db.update.mock.results[1].value.set).toHaveBeenCalledWith({ sessaoAberta: false });
  });

  it.each(["renomear", "mover"])("%s recusa transação se uma reescrita não for gravada", async (operacao) => {
    const todas = [
      { ...linha, pasta: "Pasta", titulo: "Antigo" },
      { ...linha, id: "8", titulo: "Outra", conteudo: "[[Pasta/Antigo]]" },
    ];
    if (operacao === "renomear") {
      simulacao.db.select.mockReturnValueOnce(consulta(todas));
    } else {
      simulacao.db.select.mockReturnValueOnce(consulta([todas[0]]));
      simulacao.db.selectDistinct.mockReturnValueOnce(consulta([]));
    }
    simulacao.db.select.mockReturnValueOnce(consulta([])); // título livre
    if (operacao === "mover") simulacao.db.select.mockReturnValueOnce(consulta(todas));
    simulacao.db.select.mockReturnValueOnce(consulta([{ ...todas[1], revisao: 2 }])); // CAS da reescrita recusado
    simulacao.db.update.mockReturnValueOnce(consulta([{ ...todas[0], revisao: 2 }]))
      .mockReturnValueOnce(consulta([])) // fecha versão anterior do alvo
      .mockReturnValueOnce(consulta([])); // UPDATE da outra nota não retorna linha
    simulacao.db.insert.mockReturnValueOnce(consulta([]));
    const repo = criarRepositorioDoBanco(USUARIO);
    const opcoes = { revisaoBase: 1, autor: { criadoPor: "agente" as const } };
    await expect(operacao === "renomear" ? repo.renomearNota("7", "Novo", opcoes)
      : repo.atualizarNota("7", { pasta: "Destino" }, opcoes)).rejects.toThrow(/Falha interna ao reescrever/);
  });

  it("não consulta SQL para ids inválidos nem para buscas vazias ou simbólicas", async () => {
    const repo = criarRepositorioDoBanco(USUARIO);
    for (const id of ["abc", "", "1.2", "-1", "9223372036854775808"]) {
      expect(await repo.obterNota(id)).toBeNull();
      expect(await repo.atualizarNota(id, {}, { revisaoBase: 1, autor: AUTOR })).toEqual({ tipo: "nao-encontrada" });
      expect(await repo.renomearNota(id, "B", { revisaoBase: 1, autor: AUTOR })).toEqual({ tipo: "nao-encontrada" });
    }
    for (const busca of ["", "%", '"', "_", "\\"]) expect(await repo.buscarPorConteudo(busca, 10)).toEqual([]);
    expect(simulacao.db.select).not.toHaveBeenCalled();
    expect(simulacao.db.transaction).not.toHaveBeenCalled();
  });

  it("normaliza tags nulas e datas e preserva ids bigint sem perda de precisão", async () => {
    simulacao.db.select.mockReturnValueOnce(consulta([{ ...linha, id: "9223372036854775807" }]));
    expect(await criarRepositorioDoBanco(USUARIO).obterNota("9223372036854775807"))
      .toMatchObject({ id: "9223372036854775807", tags: [], criadoEm: momento.toISOString(), atualizadoEm: momento.toISOString() });
  });

  it("CAS que não atualizou nada retorna conflito com a nota atual sem versionar", async () => {
    const atualizacao = consulta([]);
    simulacao.db.select.mockReturnValueOnce(consulta([linha])).mockReturnValueOnce(consulta([{ ...linha, revisao: 2 }]));
    simulacao.db.update.mockReturnValueOnce(atualizacao);
    const resultado = await criarRepositorioDoBanco(USUARIO).atualizarNota("7", { conteudo: "novo" }, { revisaoBase: 1, autor: AUTOR });
    expect(resultado).toMatchObject({ tipo: "conflito", atual: { revisao: 2 } });
    const filtro = new PgDialect().sqlToQuery(atualizacao.where.mock.calls[0][0] as SQL);
    expect(filtro.sql).toContain('"notas"."revisao"');
    expect(filtro.params).toEqual([USUARIO, "7", 1]);
    expect(simulacao.db.insert).not.toHaveBeenCalled();
  });

  it("checkpoint sem mudança fecha a sessão sem gastar revisão nem criar versão", async () => {
    simulacao.db.select.mockReturnValueOnce(consulta([linha]));
    const fechamento = consulta([]);
    simulacao.db.update.mockReturnValueOnce(fechamento);
    const resultado = await criarRepositorioDoBanco(USUARIO).atualizarNota("7", {}, {
      revisaoBase: 1, autor: AUTOR, checkpoint: true,
    });
    expect(resultado).toMatchObject({ tipo: "ok", nota: { revisao: 1 } });
    expect(fechamento.set).toHaveBeenCalledWith({ sessaoAberta: false });
    expect(simulacao.db.insert).not.toHaveBeenCalled();
  });
});
