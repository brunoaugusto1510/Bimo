import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Mesmo padrão de `notas.test.ts`/`entidades.test.ts`, mas com uma cadeia
 * maior: `buscarNotasPorTexto` faz DUAS consultas encadeadas (a subconsulta
 * que filtra+rankeia+limita, terminando em `.as()`, e a consulta externa que
 * calcula o `ts_headline` sobre ela, terminando em `.orderBy()` já
 * aguardável). `buscarEntidadesPorTexto` faz só uma, terminando em `.limit()`
 * aguardável (sem `.as()`, não precisa de headline).
 */

function encadeavelComLimiteEAs<T>(subquery: T) {
  const asMock = vi.fn(() => subquery);
  const limitMock = vi.fn(() => ({ as: asMock }));
  const orderByMock = vi.fn(() => ({ limit: limitMock }));
  const whereMock = vi.fn(() => ({ orderBy: orderByMock }));
  const fromMock = vi.fn(() => ({ where: whereMock }));
  return { fromMock, whereMock, orderByMock, limitMock, asMock };
}

function encadeavelComOrderByFinal<T>(resultado: T[] | Promise<never>) {
  const orderByMock = vi.fn(() => resultado);
  const fromMock = vi.fn(() => ({ orderBy: orderByMock }));
  return { fromMock, orderByMock };
}

function encadeavelComLimiteFinal<T>(resultado: T[] | Promise<never>) {
  const limitMock = vi.fn(() => resultado);
  const orderByMock = vi.fn(() => ({ limit: limitMock }));
  const whereMock = vi.fn(() => ({ orderBy: orderByMock }));
  const fromMock = vi.fn(() => ({ where: whereMock }));
  return { fromMock, whereMock, orderByMock, limitMock };
}

const selectMock = vi.fn();

vi.mock("../db/cliente", () => ({
  db: { select: (...args: unknown[]) => selectMock(...args) },
}));

const { buscarEntidadesPorTexto, buscarNoConhecimento, buscarNotasPorTexto } = await import(
  "../busca-textual"
);

const SUBQUERY_FAKE = {
  id: "id",
  titulo: "titulo",
  pasta: "pasta",
  conteudo: "conteudo",
  atualizadoEm: "atualizadoEm",
  pontuacao: "pontuacao",
};

const LINHA_NOTA_FAKE = {
  id: 6,
  titulo: "Análise de código",
  pasta: null,
  pontuacao: 0.389_62,
  trecho: "Uma reunião sobre a análise dos **códigos** do projeto.",
};

const LINHA_ENTIDADE_FAKE = {
  id: 8,
  nome: "Reunião de Análise",
  categoria: "evento",
  aliases: ["Reunião Códigos"],
  pontuacao: 0.400_738,
};

/** Configura as duas chamadas de `db.select` que `buscarNotasPorTexto` faz. */
function configurarBuscaDeNotas(linhas: unknown[] | Promise<never>) {
  const subconsulta = encadeavelComLimiteEAs(SUBQUERY_FAKE);
  const consultaFinal = encadeavelComOrderByFinal(linhas);
  selectMock
    .mockImplementationOnce(() => ({ from: subconsulta.fromMock }))
    .mockImplementationOnce(() => ({ from: consultaFinal.fromMock }));
  return { subconsulta, consultaFinal };
}

/** Configura a única chamada de `db.select` que `buscarEntidadesPorTexto` faz. */
function configurarBuscaDeEntidades(linhas: unknown[] | Promise<never>) {
  const consulta = encadeavelComLimiteFinal(linhas);
  selectMock.mockImplementationOnce(() => ({ from: consulta.fromMock }));
  return consulta;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("buscarNotasPorTexto", () => {
  it("mapeia linhas do banco para ResultadoNota com tipo 'nota'", async () => {
    configurarBuscaDeNotas([LINHA_NOTA_FAKE]);

    const resultado = await buscarNotasPorTexto("user-1", "codigo");

    expect(resultado).toEqual([
      {
        tipo: "nota",
        id: 6,
        titulo: "Análise de código",
        pasta: null,
        trecho: "Uma reunião sobre a análise dos **códigos** do projeto.",
        pontuacao: 0.389_62,
      },
    ]);
  });

  it("devolve [] imediatamente para consulta vazia, sem chamar db.select", async () => {
    const resultado = await buscarNotasPorTexto("user-1", "   ");

    expect(resultado).toEqual([]);
    expect(selectMock).not.toHaveBeenCalled();
  });

  it("devolve [] imediatamente para consulta com string vazia", async () => {
    const resultado = await buscarNotasPorTexto("user-1", "");

    expect(resultado).toEqual([]);
    expect(selectMock).not.toHaveBeenCalled();
  });

  it("usa limite padrão 10 quando não informado", async () => {
    const { subconsulta } = configurarBuscaDeNotas([]);

    await buscarNotasPorTexto("user-1", "codigo");

    expect(subconsulta.limitMock).toHaveBeenCalledWith(10);
  });

  it("sobe limite: 0 para o mínimo (1)", async () => {
    const { subconsulta } = configurarBuscaDeNotas([]);

    await buscarNotasPorTexto("user-1", "codigo", { limite: 0 });

    expect(subconsulta.limitMock).toHaveBeenCalledWith(1);
  });

  it("desce limite: 999 para o máximo (50)", async () => {
    const { subconsulta } = configurarBuscaDeNotas([]);

    await buscarNotasPorTexto("user-1", "codigo", { limite: 999 });

    expect(subconsulta.limitMock).toHaveBeenCalledWith(50);
  });

  it("propaga erro do banco em vez de engolir silenciosamente", async () => {
    configurarBuscaDeNotas(Promise.reject(new Error("conexão perdida")));

    await expect(buscarNotasPorTexto("user-1", "codigo")).rejects.toThrow("conexão perdida");
  });
});

describe("buscarEntidadesPorTexto", () => {
  it("devolve categoria e aliases, sem campo trecho", async () => {
    configurarBuscaDeEntidades([LINHA_ENTIDADE_FAKE]);

    const resultado = await buscarEntidadesPorTexto("user-1", "reuniao");

    expect(resultado).toEqual([
      {
        tipo: "entidade",
        id: 8,
        nome: "Reunião de Análise",
        categoria: "evento",
        aliases: ["Reunião Códigos"],
        pontuacao: 0.400_738,
      },
    ]);
    expect(resultado[0]).not.toHaveProperty("trecho");
  });

  it("devolve [] imediatamente para consulta vazia, sem chamar db.select", async () => {
    const resultado = await buscarEntidadesPorTexto("user-1", "   ");

    expect(resultado).toEqual([]);
    expect(selectMock).not.toHaveBeenCalled();
  });

  it("usa limite padrão 10 quando não informado", async () => {
    const consulta = configurarBuscaDeEntidades([]);

    await buscarEntidadesPorTexto("user-1", "reuniao");

    expect(consulta.limitMock).toHaveBeenCalledWith(10);
  });

  it("sobe limite: 0 para o mínimo (1)", async () => {
    const consulta = configurarBuscaDeEntidades([]);

    await buscarEntidadesPorTexto("user-1", "reuniao", { limite: 0 });

    expect(consulta.limitMock).toHaveBeenCalledWith(1);
  });

  it("desce limite: 999 para o máximo (50)", async () => {
    const consulta = configurarBuscaDeEntidades([]);

    await buscarEntidadesPorTexto("user-1", "reuniao", { limite: 999 });

    expect(consulta.limitMock).toHaveBeenCalledWith(50);
  });

  it("propaga erro do banco em vez de engolir silenciosamente", async () => {
    configurarBuscaDeEntidades(Promise.reject(new Error("conexão perdida")));

    await expect(buscarEntidadesPorTexto("user-1", "reuniao")).rejects.toThrow(
      "conexão perdida",
    );
  });
});

describe("buscarNoConhecimento", () => {
  it("roda as duas buscas e devolve { notas, entidades } sem achatar", async () => {
    configurarBuscaDeNotas([LINHA_NOTA_FAKE]);
    configurarBuscaDeEntidades([LINHA_ENTIDADE_FAKE]);

    const resultado = await buscarNoConhecimento("user-1", "analise");

    expect(resultado.notas).toEqual([
      expect.objectContaining({ tipo: "nota", id: 6 }),
    ]);
    expect(resultado.entidades).toEqual([
      expect.objectContaining({ tipo: "entidade", id: 8 }),
    ]);
    // 2 chamadas de select para notas (subconsulta + consulta final) + 1 para entidades.
    expect(selectMock).toHaveBeenCalledTimes(3);
  });

  it("consulta vazia devolve os dois lados vazios, sem tocar o banco", async () => {
    const resultado = await buscarNoConhecimento("user-1", "   ");

    expect(resultado).toEqual({ notas: [], entidades: [] });
    expect(selectMock).not.toHaveBeenCalled();
  });
});
