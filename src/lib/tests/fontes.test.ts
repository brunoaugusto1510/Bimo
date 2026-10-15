import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Mesmo padrão de `vault-real.test.ts`: mocka os módulos de que `fontes.ts`
 * depende (`./db/cliente`, `./supabase-storage`) e testa a lógica de domínio
 * de verdade — não o schema em si, que é importado normal (é só declaração,
 * sem I/O).
 */

const valuesMock = vi.fn();
const returningMock = vi.fn();
const insertMock = vi.fn(() => ({ values: valuesMock }));

const whereMock = vi.fn();
const fromMockSelect = vi.fn(() => ({ where: whereMock }));
const selectMock = vi.fn(() => ({ from: fromMockSelect }));

vi.mock("../db/cliente", () => ({
  db: { insert: insertMock, select: selectMock },
}));

const enviarArquivoMock = vi.fn();
const removerArquivoMock = vi.fn();
const getConfigStorageMock = vi.fn(() => ({ url: "https://x", chaveServico: "chave-fake" }));

vi.mock("../supabase-storage", () => ({
  enviarArquivo: enviarArquivoMock,
  removerArquivo: removerArquivoMock,
  getConfigStorage: getConfigStorageMock,
}));

const buscarPaginaMock = vi.fn();
vi.mock("../busca-web", () => ({ buscarPagina: buscarPaginaMock }));

const { criarFonte, criarFonteDeUrl, listarFontes, obterFonte } = await import("../fontes");

/** Devolve algo que funciona tanto com `await` direto quanto com `.orderBy()` encadeado. */
function resultadoDeQuery<T>(valor: T) {
  const promessa = Promise.resolve(valor) as Promise<T> & { orderBy: ReturnType<typeof vi.fn> };
  promessa.orderBy = vi.fn(() => Promise.resolve(valor));
  return promessa;
}

const FONTE_FAKE = {
  id: 1,
  userId: "user-1",
  caminhoArmazenamento: "user-1/algum-uuid",
  nomeArquivoOriginal: "artigo.pdf",
  tipoMime: "application/pdf",
  hashConteudo: "hash-fake",
  criadoEm: new Date("2026-01-01T00:00:00Z"),
};

beforeEach(() => {
  vi.clearAllMocks();
  valuesMock.mockReturnValue({ returning: returningMock });
  removerArquivoMock.mockResolvedValue(undefined);
});

describe("criarFonte", () => {
  it("envia o arquivo pro Storage antes de inserir a linha no banco", async () => {
    returningMock.mockResolvedValue([FONTE_FAKE]);

    const resultado = await criarFonte({
      userId: "user-1",
      conteudo: Buffer.from("conteudo do pdf"),
      nomeArquivoOriginal: "artigo.pdf",
      tipoMime: "application/pdf",
    });

    expect(enviarArquivoMock).toHaveBeenCalled();
    expect(insertMock).toHaveBeenCalled();
    expect(resultado).toEqual(FONTE_FAKE);

    // O caminho gerado começa com o userId — organização por dono no bucket.
    const [, caminhoEnviado] = enviarArquivoMock.mock.calls[0];
    expect(caminhoEnviado.startsWith("user-1/")).toBe(true);
  });

  it("remove o arquivo do Storage e relança o erro se o insert no banco falhar", async () => {
    const erroDoBanco = new Error("conexão recusada");
    returningMock.mockRejectedValue(erroDoBanco);

    await expect(
      criarFonte({
        userId: "user-1",
        conteudo: Buffer.from("x"),
        nomeArquivoOriginal: "nota.md",
      }),
    ).rejects.toThrow("conexão recusada");

    expect(removerArquivoMock).toHaveBeenCalled();
  });
});

describe("criarFonteDeUrl", () => {
  it("busca a página, envia o HTML pro Storage e insere com urlOrigem preenchido", async () => {
    buscarPaginaMock.mockResolvedValue({
      conteudo: Buffer.from("<html>conteúdo</html>"),
      tipoMime: "text/html",
    });
    returningMock.mockResolvedValue([{ ...FONTE_FAKE, urlOrigem: "https://exemplo.com/artigo" }]);

    const resultado = await criarFonteDeUrl({ userId: "user-1", url: "https://exemplo.com/artigo" });

    expect(buscarPaginaMock).toHaveBeenCalledWith("https://exemplo.com/artigo");
    expect(enviarArquivoMock).toHaveBeenCalled();
    expect(valuesMock).toHaveBeenCalledWith(
      expect.objectContaining({ urlOrigem: "https://exemplo.com/artigo", tipoMime: "text/html" }),
    );
    expect(resultado.urlOrigem).toBe("https://exemplo.com/artigo");
  });

  it("remove o arquivo do Storage e relança o erro se o insert falhar", async () => {
    buscarPaginaMock.mockResolvedValue({ conteudo: Buffer.from("<html></html>"), tipoMime: "text/html" });
    returningMock.mockRejectedValue(new Error("conexão recusada"));

    await expect(
      criarFonteDeUrl({ userId: "user-1", url: "https://exemplo.com/artigo" }),
    ).rejects.toThrow("conexão recusada");

    expect(removerArquivoMock).toHaveBeenCalled();
  });
});

describe("obterFonte", () => {
  it("devolve a fonte quando encontrada", async () => {
    whereMock.mockReturnValue(resultadoDeQuery([FONTE_FAKE]));

    const resultado = await obterFonte("user-1", 1);

    expect(resultado).toEqual(FONTE_FAKE);
  });

  it("devolve undefined quando não encontra nada", async () => {
    whereMock.mockReturnValue(resultadoDeQuery([]));

    const resultado = await obterFonte("user-1", 999);

    expect(resultado).toBeUndefined();
  });
});

describe("listarFontes", () => {
  it("devolve as fontes do usuário", async () => {
    whereMock.mockReturnValue(resultadoDeQuery([FONTE_FAKE]));

    const resultado = await listarFontes("user-1");

    expect(resultado).toEqual([FONTE_FAKE]);
  });
});
