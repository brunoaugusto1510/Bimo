import { beforeEach, describe, expect, it, vi } from "vitest";

function resultadoDeSelect<T>(valor: T) {
  const promessa = Promise.resolve(valor) as Promise<T> & { orderBy: ReturnType<typeof vi.fn> };
  promessa.orderBy = vi.fn(() => Promise.resolve(valor));
  return promessa;
}

const whereMockSelect = vi.fn();
const fromMockSelect = vi.fn(() => ({ where: whereMockSelect }));
const selectMock = vi.fn(() => ({ from: fromMockSelect }));

vi.mock("../db/cliente", () => ({ db: { select: selectMock } }));

const atualizarEntidadeMock = vi.fn();
vi.mock("../entidades", () => ({ atualizarEntidade: atualizarEntidadeMock }));

const atualizarNotaMock = vi.fn();
vi.mock("../notas", () => ({ atualizarNota: atualizarNotaMock }));

const { listarVersoesEntidade, listarVersoesNota, restaurarVersaoEntidade, restaurarVersaoNota } =
  await import("../versoes");

const VERSAO_ENTIDADE_FAKE = {
  id: 5,
  entidadeId: 42,
  userId: "user-1",
  nome: "RAG",
  tipo: "conceito",
  aliases: ["Retrieval-Augmented Generation"],
  confianca: "0.60",
  status: "rascunho" as const,
  criadoPor: "agente" as const,
  criadoPorFerramenta: "create_entity",
  versionadoEm: new Date("2026-01-01T00:00:00Z"),
};

const VERSAO_NOTA_FAKE = {
  id: 9,
  notaId: 7,
  userId: "user-1",
  titulo: "Bem-vindo",
  conteudo: "Conteúdo antigo.",
  pasta: "Projetos/Bimo",
  tags: ["intro"],
  criadoPor: "usuario" as const,
  criadoPorFerramenta: null,
  versionadoEm: new Date("2026-01-01T00:00:00Z"),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listarVersoesEntidade", () => {
  it("devolve o histórico da entidade", async () => {
    whereMockSelect.mockReturnValue(resultadoDeSelect([VERSAO_ENTIDADE_FAKE]));

    const resultado = await listarVersoesEntidade("user-1", 42);

    expect(resultado).toEqual([VERSAO_ENTIDADE_FAKE]);
  });
});

describe("restaurarVersaoEntidade", () => {
  it("busca a versão e chama atualizarEntidade com o conteúdo antigo (confiança convertida pra número)", async () => {
    whereMockSelect.mockReturnValue(resultadoDeSelect([VERSAO_ENTIDADE_FAKE]));
    atualizarEntidadeMock.mockResolvedValue({ id: 42, nome: "RAG" });

    await restaurarVersaoEntidade("user-1", 42, 5, "usuario");

    expect(atualizarEntidadeMock).toHaveBeenCalledWith("user-1", 42, {
      nome: "RAG",
      tipo: "conceito",
      aliases: ["Retrieval-Augmented Generation"],
      confianca: 0.6,
      status: "rascunho",
      editadoPor: "usuario",
    });
  });

  it("lança erro quando a versão não existe", async () => {
    whereMockSelect.mockReturnValue(resultadoDeSelect([]));

    await expect(restaurarVersaoEntidade("user-1", 42, 999, "usuario")).rejects.toThrow(
      /não encontrada/,
    );
    expect(atualizarEntidadeMock).not.toHaveBeenCalled();
  });
});

describe("listarVersoesNota", () => {
  it("devolve o histórico da nota", async () => {
    whereMockSelect.mockReturnValue(resultadoDeSelect([VERSAO_NOTA_FAKE]));

    const resultado = await listarVersoesNota("user-1", 7);

    expect(resultado).toEqual([VERSAO_NOTA_FAKE]);
  });
});

describe("restaurarVersaoNota", () => {
  it("busca a versão e chama atualizarNota com o conteúdo antigo", async () => {
    whereMockSelect.mockReturnValue(resultadoDeSelect([VERSAO_NOTA_FAKE]));
    atualizarNotaMock.mockResolvedValue({ id: 7, titulo: "Bem-vindo" });

    await restaurarVersaoNota("user-1", 7, 9, "agente");

    expect(atualizarNotaMock).toHaveBeenCalledWith("user-1", 7, {
      titulo: "Bem-vindo",
      conteudo: "Conteúdo antigo.",
      pasta: "Projetos/Bimo",
      tags: ["intro"],
      editadoPor: "agente",
    });
  });

  it("lança erro quando a versão não existe", async () => {
    whereMockSelect.mockReturnValue(resultadoDeSelect([]));

    await expect(restaurarVersaoNota("user-1", 7, 999, "agente")).rejects.toThrow(/não encontrada/);
    expect(atualizarNotaMock).not.toHaveBeenCalled();
  });
});
