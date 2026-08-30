import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Mesmo padrão de `github.test.ts`: mocka o cliente externo (aqui,
 * `@supabase/supabase-js`) e testa de verdade os helpers deste módulo
 * (montagem de caminho, tratamento de erro, conversão pra Buffer).
 */
const uploadMock = vi.fn();
const downloadMock = vi.fn();
const removeMock = vi.fn();
const fromMock = vi.fn(() => ({ upload: uploadMock, download: downloadMock, remove: removeMock }));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ storage: { from: fromMock } })),
}));

const { baixarArquivo, enviarArquivo, getConfigStorage, removerArquivo } = await import(
  "./supabase-storage"
);

const CFG = { url: "https://exemplo.supabase.co", chaveServico: "chave-fake" };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getConfigStorage", () => {
  const ENV_ORIGINAL = { ...process.env };

  afterEach(() => {
    process.env = { ...ENV_ORIGINAL };
  });

  it("lê SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY das variáveis de ambiente", () => {
    process.env.SUPABASE_URL = CFG.url;
    process.env.SUPABASE_SERVICE_ROLE_KEY = CFG.chaveServico;

    expect(getConfigStorage()).toEqual(CFG);
  });

  it("lança erro claro se SUPABASE_URL estiver faltando", () => {
    delete process.env.SUPABASE_URL;
    process.env.SUPABASE_SERVICE_ROLE_KEY = CFG.chaveServico;

    expect(() => getConfigStorage()).toThrow(/SUPABASE_URL/);
  });

  it("lança erro claro se SUPABASE_SERVICE_ROLE_KEY estiver faltando", () => {
    process.env.SUPABASE_URL = CFG.url;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    expect(() => getConfigStorage()).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });
});

describe("enviarArquivo", () => {
  it("envia os bytes pro bucket 'fontes' sem upsert (Fonte é imutável)", async () => {
    uploadMock.mockResolvedValue({ data: {}, error: null });

    await enviarArquivo(CFG, "user1/abc", Buffer.from("conteudo"), "text/markdown");

    expect(fromMock).toHaveBeenCalledWith("fontes");
    expect(uploadMock).toHaveBeenCalledWith("user1/abc", Buffer.from("conteudo"), {
      contentType: "text/markdown",
      upsert: false,
    });
  });

  it("lança erro com o caminho quando o Storage recusa o upload", async () => {
    uploadMock.mockResolvedValue({ data: null, error: { message: "bucket cheio" } });

    await expect(enviarArquivo(CFG, "user1/abc", Buffer.from("x"))).rejects.toThrow(/user1\/abc/);
  });
});

describe("baixarArquivo", () => {
  it("devolve os bytes como Buffer", async () => {
    const bytes = new TextEncoder().encode("olá");
    downloadMock.mockResolvedValue({ data: { arrayBuffer: async () => bytes.buffer }, error: null });

    const resultado = await baixarArquivo(CFG, "user1/abc");

    expect(resultado.toString()).toBe("olá");
  });

  it("lança erro quando o Storage não encontra o arquivo", async () => {
    downloadMock.mockResolvedValue({ data: null, error: { message: "not found" } });

    await expect(baixarArquivo(CFG, "user1/abc")).rejects.toThrow(/user1\/abc/);
  });
});

describe("removerArquivo", () => {
  it("remove o arquivo do bucket", async () => {
    removeMock.mockResolvedValue({ data: {}, error: null });

    await removerArquivo(CFG, "user1/abc");

    expect(removeMock).toHaveBeenCalledWith(["user1/abc"]);
  });

  it("lança erro quando a remoção falha", async () => {
    removeMock.mockResolvedValue({ data: null, error: { message: "falhou" } });

    await expect(removerArquivo(CFG, "user1/abc")).rejects.toThrow(/user1\/abc/);
  });
});
