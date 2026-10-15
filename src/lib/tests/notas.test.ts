import { beforeEach, describe, expect, it, vi } from "vitest";

/** Mesmo padrão de `entidades.test.ts`. */

function resultadoDeInsert<T>(valor: T) {
  const promessa = Promise.resolve(valor) as Promise<T> & { returning: ReturnType<typeof vi.fn> };
  promessa.returning = vi.fn(() => Promise.resolve(valor));
  return promessa;
}

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

const { atualizarNota, criarNota, listarNotas, obterNota } = await import("../notas");

const NOTA_FAKE = {
  id: 7,
  userId: "user-1",
  titulo: "Bem-vindo",
  conteudo: "Conteúdo em markdown.",
  pasta: "Projetos/Bimo",
  tags: ["intro"],
  criadoPor: "usuario" as const,
  criadoPorFerramenta: null,
  criadoEm: new Date("2026-01-01T00:00:00Z"),
  atualizadoEm: new Date("2026-01-01T00:00:00Z"),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("criarNota", () => {
  it("insere em nos, notas e versoes_nota dentro de uma transação", async () => {
    txValuesMock
      .mockImplementationOnce(() => resultadoDeInsert([{ id: 7 }])) // nos
      .mockImplementationOnce(() => resultadoDeInsert([NOTA_FAKE])) // notas
      .mockImplementationOnce(() => resultadoDeInsert(undefined)); // versoes_nota

    const resultado = await criarNota({
      userId: "user-1",
      titulo: "Bem-vindo",
      conteudo: "Conteúdo em markdown.",
      pasta: "Projetos/Bimo",
      criadoPor: "usuario",
    });

    expect(transactionMock).toHaveBeenCalled();
    expect(txInsertMock).toHaveBeenCalledTimes(3);
    expect(resultado).toEqual(NOTA_FAKE);

    // A versão registra a pasta também — snapshot completo (Decisão 4).
    const valoresVersao = txValuesMock.mock.calls[2][0];
    expect(valoresVersao.pasta).toBe("Projetos/Bimo");
  });
});

describe("atualizarNota", () => {
  it("atualiza a nota e registra uma nova versão com a autoria do editor", async () => {
    const NOTA_EDITADA = { ...NOTA_FAKE, conteudo: "Conteúdo revisado." };
    txReturningMock.mockResolvedValue([NOTA_EDITADA]);
    txValuesMock.mockReturnValue(resultadoDeInsert(undefined));

    const resultado = await atualizarNota("user-1", 7, {
      conteudo: "Conteúdo revisado.",
      editadoPor: "agente",
      editadoPorFerramenta: "editar_nota",
    });

    expect(resultado).toEqual(NOTA_EDITADA);
    const valoresVersao = txValuesMock.mock.calls[0][0];
    expect(valoresVersao.criadoPor).toBe("agente");
    expect(valoresVersao.conteudo).toBe("Conteúdo revisado.");
  });

  it("lança erro quando a nota não existe (ou não é do usuário)", async () => {
    txReturningMock.mockResolvedValue([]);

    await expect(
      atualizarNota("user-1", 999, { editadoPor: "usuario", titulo: "X" }),
    ).rejects.toThrow(/não encontrada/);
  });
});

describe("obterNota", () => {
  it("devolve a nota quando encontrada", async () => {
    whereMockSelect.mockReturnValue(resultadoDeSelect([NOTA_FAKE]));

    const resultado = await obterNota("user-1", 7);

    expect(resultado).toEqual(NOTA_FAKE);
  });

  it("devolve undefined quando não encontra", async () => {
    whereMockSelect.mockReturnValue(resultadoDeSelect([]));

    const resultado = await obterNota("user-1", 999);

    expect(resultado).toBeUndefined();
  });
});

describe("listarNotas", () => {
  it("devolve as notas do usuário", async () => {
    whereMockSelect.mockReturnValue(resultadoDeSelect([NOTA_FAKE]));

    const resultado = await listarNotas("user-1");

    expect(resultado).toEqual([NOTA_FAKE]);
  });
});
