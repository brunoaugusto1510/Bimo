import { beforeEach, describe, expect, it, vi } from "vitest";

const whereMockSelect = vi.fn();
const fromMockSelect = vi.fn(() => ({ where: whereMockSelect }));
const selectMock = vi.fn(() => ({ from: fromMockSelect }));

const returningMockInsert = vi.fn();
const valuesMock = vi.fn(() => ({ returning: returningMockInsert }));
const insertMock = vi.fn(() => ({ values: valuesMock }));

const returningMockUpdate = vi.fn();
const whereMockUpdate = vi.fn(() => ({ returning: returningMockUpdate }));
const setMock = vi.fn(() => ({ where: whereMockUpdate }));
const updateMock = vi.fn(() => ({ set: setMock }));

vi.mock("../db/cliente", () => ({
  db: { select: selectMock, insert: insertMock, update: updateMock },
}));

const { criarRelacao, listarRelacoesDoNo, removerRelacao } = await import("../relacoes");

const RELACAO_FAKE = {
  id: 1,
  userId: "user-1",
  origemId: 10,
  destinoId: 20,
  tipo: "depende_de" as const,
  criadoPor: "agente" as const,
  criadoPorFerramenta: "create_relationship",
  criadoEm: new Date("2026-01-01T00:00:00Z"),
  removidoEm: null,
  removidoPor: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("criarRelacao", () => {
  it("cria quando origem e destino pertencem ao mesmo usuário", async () => {
    whereMockSelect.mockResolvedValue([
      { id: 10, userId: "user-1" },
      { id: 20, userId: "user-1" },
    ]);
    returningMockInsert.mockResolvedValue([RELACAO_FAKE]);

    const resultado = await criarRelacao({
      userId: "user-1",
      origemId: 10,
      destinoId: 20,
      tipo: "depende_de",
      criadoPor: "agente",
      criadoPorFerramenta: "create_relationship",
    });

    expect(resultado).toEqual(RELACAO_FAKE);
  });

  it("lança erro quando a origem não pertence ao usuário", async () => {
    whereMockSelect.mockResolvedValue([
      { id: 10, userId: "outro-usuario" },
      { id: 20, userId: "user-1" },
    ]);

    await expect(
      criarRelacao({
        userId: "user-1",
        origemId: 10,
        destinoId: 20,
        tipo: "relaciona_com",
        criadoPor: "usuario",
      }),
    ).rejects.toThrow(/origem/);

    expect(insertMock).not.toHaveBeenCalled();
  });

  it("lança erro quando o destino não existe", async () => {
    whereMockSelect.mockResolvedValue([{ id: 10, userId: "user-1" }]);

    await expect(
      criarRelacao({
        userId: "user-1",
        origemId: 10,
        destinoId: 999,
        tipo: "relaciona_com",
        criadoPor: "usuario",
      }),
    ).rejects.toThrow(/destino/);

    expect(insertMock).not.toHaveBeenCalled();
  });
});

describe("removerRelacao", () => {
  it("marca removidoEm/removidoPor sem apagar a linha", async () => {
    const REMOVIDA = { ...RELACAO_FAKE, removidoEm: new Date(), removidoPor: "usuario" as const };
    returningMockUpdate.mockResolvedValue([REMOVIDA]);

    const resultado = await removerRelacao("user-1", 1, "usuario");

    expect(resultado.removidoPor).toBe("usuario");
    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({ removidoPor: "usuario", removidoEm: expect.any(Date) }),
    );
  });

  it("lança erro quando a relação não existe (ou não é do usuário)", async () => {
    returningMockUpdate.mockResolvedValue([]);

    await expect(removerRelacao("user-1", 999, "usuario")).rejects.toThrow(/não encontrada/);
  });
});

describe("listarRelacoesDoNo", () => {
  it("devolve as relações que tocam o nó", async () => {
    whereMockSelect.mockResolvedValue([RELACAO_FAKE]);

    const resultado = await listarRelacoesDoNo("user-1", 10);

    expect(resultado).toEqual([RELACAO_FAKE]);
  });
});
