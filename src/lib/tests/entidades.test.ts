import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Mesmo padrão de `fontes.test.ts`: mocka `./db/cliente` (incluindo
 * `transaction`, já que `criarEntidade`/`atualizarEntidade` usam) e importa o
 * schema real (é só declaração, sem I/O).
 */

/** Devolve algo que funciona tanto com `await` direto quanto com `.returning()` encadeado. */
function resultadoDeInsert<T>(valor: T) {
  const promessa = Promise.resolve(valor) as Promise<T> & { returning: ReturnType<typeof vi.fn> };
  promessa.returning = vi.fn(() => Promise.resolve(valor));
  return promessa;
}

/** Devolve algo que funciona tanto com `await` direto quanto com `.orderBy()` encadeado. */
function resultadoDeSelect<T>(valor: T) {
  const promessa = Promise.resolve(valor) as Promise<T> & { orderBy: ReturnType<typeof vi.fn> };
  promessa.orderBy = vi.fn(() => Promise.resolve(valor));
  return promessa;
}

const txValuesMock = vi.fn();
const txInsertMock = vi.fn(() => ({ values: txValuesMock }));

const txReturningMock = vi.fn();
const txWhereMock = vi.fn(() => ({ returning: txReturningMock }));
const txSetMock = vi.fn(() => ({ where: txWhereMock }));
const txUpdateMock = vi.fn(() => ({ set: txSetMock }));

type TxFake = { insert: typeof txInsertMock; update: typeof txUpdateMock };
const tx: TxFake = { insert: txInsertMock, update: txUpdateMock };
const transactionMock = vi.fn((callback: (tx: TxFake) => unknown) => callback(tx));

const whereMockSelect = vi.fn();
const fromMockSelect = vi.fn(() => ({ where: whereMockSelect }));
const selectMock = vi.fn(() => ({ from: fromMockSelect }));

vi.mock("../db/cliente", () => ({
  db: { transaction: transactionMock, select: selectMock },
}));

const { atualizarEntidade, criarEntidade, listarEntidades, obterEntidade } = await import(
  "../entidades"
);

const ENTIDADE_FAKE = {
  id: 42,
  userId: "user-1",
  nome: "RAG",
  tipo: "conceito",
  aliases: ["Retrieval-Augmented Generation"],
  confianca: "0.80",
  status: "rascunho" as const,
  criadoPor: "agente" as const,
  criadoPorFerramenta: "create_entity",
  criadoEm: new Date("2026-01-01T00:00:00Z"),
  atualizadoEm: new Date("2026-01-01T00:00:00Z"),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("criarEntidade", () => {
  it("insere em nos, entidades e versoes_entidade dentro de uma transação", async () => {
    txValuesMock
      .mockImplementationOnce(() => resultadoDeInsert([{ id: 42 }])) // nos
      .mockImplementationOnce(() => resultadoDeInsert([ENTIDADE_FAKE])) // entidades
      .mockImplementationOnce(() => resultadoDeInsert(undefined)); // versoes_entidade

    const resultado = await criarEntidade({
      userId: "user-1",
      nome: "RAG",
      criadoPor: "agente",
      criadoPorFerramenta: "create_entity",
      confianca: 0.8,
    });

    expect(transactionMock).toHaveBeenCalled();
    expect(txInsertMock).toHaveBeenCalledTimes(3);
    expect(resultado).toEqual(ENTIDADE_FAKE);
  });

  it("converte confiança de número (0-1) para string com 2 casas decimais", async () => {
    txValuesMock
      .mockImplementationOnce(() => resultadoDeInsert([{ id: 42 }]))
      .mockImplementationOnce(() => resultadoDeInsert([ENTIDADE_FAKE]))
      .mockImplementationOnce(() => resultadoDeInsert(undefined));

    await criarEntidade({ userId: "user-1", nome: "RAG", criadoPor: "agente", confianca: 0.8 });

    const valoresEntidade = txValuesMock.mock.calls[1][0];
    expect(valoresEntidade.confianca).toBe("0.80");
  });
});

describe("atualizarEntidade", () => {
  it("atualiza a entidade e registra uma nova versão com a autoria do editor", async () => {
    const ENTIDADE_APROVADA = { ...ENTIDADE_FAKE, status: "aprovada" as const };
    txReturningMock.mockResolvedValue([ENTIDADE_APROVADA]);
    txValuesMock.mockReturnValue(resultadoDeInsert(undefined));

    const resultado = await atualizarEntidade("user-1", 42, {
      status: "aprovada",
      editadoPor: "usuario",
    });

    expect(resultado).toEqual(ENTIDADE_APROVADA);
    // A versão registrada carrega a autoria de quem editou, não a original da entidade.
    const valoresVersao = txValuesMock.mock.calls[0][0];
    expect(valoresVersao.criadoPor).toBe("usuario");
    expect(valoresVersao.status).toBe("aprovada");
  });

  it("lança erro quando a entidade não existe (ou não é do usuário)", async () => {
    txReturningMock.mockResolvedValue([]);

    await expect(
      atualizarEntidade("user-1", 999, { editadoPor: "usuario", nome: "Outro nome" }),
    ).rejects.toThrow(/não encontrada/);
  });
});

describe("obterEntidade", () => {
  it("devolve a entidade quando encontrada", async () => {
    whereMockSelect.mockReturnValue(resultadoDeSelect([ENTIDADE_FAKE]));

    const resultado = await obterEntidade("user-1", 42);

    expect(resultado).toEqual(ENTIDADE_FAKE);
  });

  it("devolve undefined quando não encontra", async () => {
    whereMockSelect.mockReturnValue(resultadoDeSelect([]));

    const resultado = await obterEntidade("user-1", 999);

    expect(resultado).toBeUndefined();
  });
});

describe("listarEntidades", () => {
  it("devolve as entidades do usuário", async () => {
    whereMockSelect.mockReturnValue(resultadoDeSelect([ENTIDADE_FAKE]));

    const resultado = await listarEntidades("user-1");

    expect(resultado).toEqual([ENTIDADE_FAKE]);
  });
});
