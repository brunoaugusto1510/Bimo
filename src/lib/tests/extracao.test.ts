import { beforeEach, describe, expect, it, vi } from "vitest";

const obterFonteMock = vi.fn();
vi.mock("../fontes", () => ({ obterFonte: obterFonteMock }));

const baixarArquivoMock = vi.fn();
const getConfigStorageMock = vi.fn(() => ({ url: "https://x", chaveServico: "chave-fake" }));
vi.mock("../supabase-storage", () => ({
  baixarArquivo: baixarArquivoMock,
  getConfigStorage: getConfigStorageMock,
}));

const getDocumentProxyMock = vi.fn();
const extractTextMock = vi.fn();
vi.mock("unpdf", () => ({
  getDocumentProxy: getDocumentProxyMock,
  extractText: extractTextMock,
}));

const { ExtracaoNaoSuportadaError, extrairTexto, extrairTextoDaFonte } = await import(
  "../extracao"
);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("extrairTexto", () => {
  it("decodifica Markdown como texto puro", async () => {
    const resultado = await extrairTexto({
      conteudo: Buffer.from("# Título\n\nConteúdo em markdown."),
      tipoMime: "text/markdown",
      nomeArquivoOriginal: "nota.md",
    });

    expect(resultado).toEqual({
      texto: "# Título\n\nConteúdo em markdown.",
      tipoMime: "text/markdown",
    });
  });

  it("infere o tipo pela extensão quando tipoMime é nulo", async () => {
    const resultado = await extrairTexto({
      conteudo: Buffer.from("texto simples"),
      tipoMime: null,
      nomeArquivoOriginal: "anotacao.txt",
    });

    expect(resultado.tipoMime).toBe("text/plain");
    expect(resultado.texto).toBe("texto simples");
  });

  it("extrai texto de PDF via unpdf", async () => {
    const documentoFalso = { fake: "documento" };
    getDocumentProxyMock.mockResolvedValue(documentoFalso);
    extractTextMock.mockResolvedValue({ totalPages: 2, text: "conteúdo do pdf" });

    const bytesOriginais = Buffer.from("%PDF-1.4 conteúdo fake de pdf");
    const resultado = await extrairTexto({
      conteudo: bytesOriginais,
      tipoMime: "application/pdf",
      nomeArquivoOriginal: "artigo.pdf",
    });

    expect(getDocumentProxyMock).toHaveBeenCalledWith(new Uint8Array(bytesOriginais));
    expect(extractTextMock).toHaveBeenCalledWith(documentoFalso, { mergePages: true });
    expect(resultado).toEqual({ texto: "conteúdo do pdf", tipoMime: "application/pdf" });
  });

  it("lança ExtracaoNaoSuportadaError para tipos ainda não implementados (ex.: Word)", async () => {
    await expect(
      extrairTexto({
        conteudo: Buffer.from("conteúdo binário fake de .doc"),
        tipoMime: "application/msword",
        nomeArquivoOriginal: "documento.doc",
      }),
    ).rejects.toThrow(ExtracaoNaoSuportadaError);
  });
});

describe("extrairTextoDaFonte", () => {
  it("busca a Fonte, baixa do Storage e extrai o texto", async () => {
    obterFonteMock.mockResolvedValue({
      id: 1,
      userId: "user-1",
      caminhoArmazenamento: "user-1/abc",
      nomeArquivoOriginal: "nota.md",
      tipoMime: "text/markdown",
    });
    baixarArquivoMock.mockResolvedValue(Buffer.from("conteúdo baixado"));

    const resultado = await extrairTextoDaFonte("user-1", 1);

    expect(baixarArquivoMock).toHaveBeenCalledWith(
      { url: "https://x", chaveServico: "chave-fake" },
      "user-1/abc",
    );
    expect(resultado.texto).toBe("conteúdo baixado");
  });

  it("lança erro quando a Fonte não existe (ou não é do usuário)", async () => {
    obterFonteMock.mockResolvedValue(undefined);

    await expect(extrairTextoDaFonte("user-1", 999)).rejects.toThrow(/não encontrada/);
    expect(baixarArquivoMock).not.toHaveBeenCalled();
  });
});
