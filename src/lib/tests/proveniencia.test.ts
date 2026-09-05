import { beforeEach, describe, expect, it, vi } from "vitest";

const whereMockSelect = vi.fn();
const fromMockSelect = vi.fn(() => ({ where: whereMockSelect }));
const selectMock = vi.fn(() => ({ from: fromMockSelect }));

const returningMockInsert = vi.fn();
const valuesMock = vi.fn(() => ({ returning: returningMockInsert }));
const insertMock = vi.fn(() => ({ values: valuesMock }));

vi.mock("../db/cliente", () => ({
  db: { select: selectMock, insert: insertMock },
}));

const { listarFontesDoNo, listarProvenienciaDaFonte, vincularFonte } = await import(
  "../proveniencia"
);

const VINCULO_FAKE = {
  id: 1,
  userId: "user-1",
  fonteId: 5,
  entidadeId: 10,
  notaId: null,
  locator: null,
  vinculadoEm: new Date("2026-01-01T00:00:00Z"),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("vincularFonte", () => {
  it("grava o vínculo quando a Fonte e a Entidade pertencem ao mesmo usuário", async () => {
    whereMockSelect
      .mockResolvedValueOnce([{ id: 5 }]) // fonte encontrada
      .mockResolvedValueOnce([{ id: 10 }]); // nó encontrado
    returningMockInsert.mockResolvedValue([VINCULO_FAKE]);

    const resultado = await vincularFonte({ userId: "user-1", fonteId: 5, entidadeId: 10 });

    expect(resultado).toEqual(VINCULO_FAKE);
    expect(valuesMock).toHaveBeenCalledWith(
      expect.objectContaining({ fonteId: 5, entidadeId: 10, notaId: undefined }),
    );
  });

  it("grava o vínculo quando o alvo é uma Nota", async () => {
    whereMockSelect.mockResolvedValueOnce([{ id: 5 }]).mockResolvedValueOnce([{ id: 20 }]);
    returningMockInsert.mockResolvedValue([{ ...VINCULO_FAKE, entidadeId: null, notaId: 20 }]);

    const resultado = await vincularFonte({ userId: "user-1", fonteId: 5, notaId: 20 });

    expect(resultado.notaId).toBe(20);
  });

  it("lança erro quando a Fonte não existe (ou não é do usuário)", async () => {
    whereMockSelect.mockResolvedValueOnce([]);

    await expect(
      vincularFonte({ userId: "user-1", fonteId: 999, entidadeId: 10 }),
    ).rejects.toThrow(/Fonte/);

    expect(insertMock).not.toHaveBeenCalled();
  });

  it("lança erro quando o nó (Entidade/Nota) não existe (ou não é do usuário)", async () => {
    whereMockSelect.mockResolvedValueOnce([{ id: 5 }]).mockResolvedValueOnce([]);

    await expect(
      vincularFonte({ userId: "user-1", fonteId: 5, entidadeId: 999 }),
    ).rejects.toThrow(/Nó/);

    expect(insertMock).not.toHaveBeenCalled();
  });
});

describe("listarProvenienciaDaFonte", () => {
  it("devolve os vínculos de uma Fonte", async () => {
    whereMockSelect.mockResolvedValue([VINCULO_FAKE]);

    const resultado = await listarProvenienciaDaFonte("user-1", 5);

    expect(resultado).toEqual([VINCULO_FAKE]);
  });
});

describe("listarFontesDoNo", () => {
  it("devolve os vínculos que apontam pro nó, seja como Entidade ou Nota", async () => {
    whereMockSelect.mockResolvedValue([VINCULO_FAKE]);

    const resultado = await listarFontesDoNo("user-1", 10);

    expect(resultado).toEqual([VINCULO_FAKE]);
  });
});
