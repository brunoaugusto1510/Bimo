import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Mesmo truque de `agente.test.ts`: `new GoogleGenAI(...)` devolve um objeto
 * com `models.generateContent` controlável por teste. `Type` também precisa
 * ser mockado porque `ingestao.ts` monta `ESQUEMA_RESPOSTA` com `Type.OBJECT`
 * etc. no topo do módulo — sem isso o import quebra antes de qualquer teste rodar.
 */
const generateContentMock = vi.fn();
vi.mock("@google/genai", () => ({
  GoogleGenAI: vi.fn().mockImplementation(() => ({
    models: { generateContent: generateContentMock },
  })),
  Type: { OBJECT: "OBJECT", ARRAY: "ARRAY", STRING: "STRING" },
}));

const extrairTextoDaFonteMock = vi.fn();
vi.mock("../extracao", () => ({ extrairTextoDaFonte: extrairTextoDaFonteMock }));

const criarEntidadeMock = vi.fn();
vi.mock("../entidades", () => ({ criarEntidade: criarEntidadeMock }));

const criarNotaMock = vi.fn();
vi.mock("../notas", () => ({ criarNota: criarNotaMock }));

const vincularFonteMock = vi.fn();
vi.mock("../proveniencia", () => ({ vincularFonte: vincularFonteMock }));

const { processarFonte } = await import("../ingestao");

function respostaJson(objeto: unknown) {
  return { text: JSON.stringify(objeto) };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.GEMINI_API_KEY = "chave-fake-de-teste";
  vincularFonteMock.mockResolvedValue(undefined);
});

describe("processarFonte", () => {
  it("lança um erro claro se GEMINI_API_KEY não estiver definida", async () => {
    delete process.env.GEMINI_API_KEY;
    extrairTextoDaFonteMock.mockResolvedValue({ texto: "algum texto", tipoMime: "text/plain" });

    await expect(processarFonte("user-1", 1)).rejects.toThrow(/GEMINI_API_KEY/);
    expect(generateContentMock).not.toHaveBeenCalled();
  });

  it("não chama o Gemini quando o texto extraído está vazio", async () => {
    extrairTextoDaFonteMock.mockResolvedValue({ texto: "   ", tipoMime: "text/plain" });

    const resultado = await processarFonte("user-1", 1);

    expect(resultado).toEqual({ entidadesCriadas: 0, notasCriadas: 0 });
    expect(generateContentMock).not.toHaveBeenCalled();
  });

  it("cria as Entidades sugeridas como rascunho e grava a proveniência de cada uma", async () => {
    extrairTextoDaFonteMock.mockResolvedValue({ texto: "texto sobre TCP", tipoMime: "text/plain" });
    generateContentMock.mockResolvedValue(
      respostaJson({ entidades: [{ nome: "TCP", tipo: "protocolo" }], notas: [] }),
    );
    criarEntidadeMock.mockResolvedValue({ id: 42, userId: "user-1", nome: "TCP" });

    const resultado = await processarFonte("user-1", 7);

    expect(criarEntidadeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        nome: "TCP",
        tipo: "protocolo",
        status: "rascunho",
        criadoPor: "agente",
        criadoPorFerramenta: "processar_fonte",
      }),
    );
    expect(vincularFonteMock).toHaveBeenCalledWith({ userId: "user-1", fonteId: 7, entidadeId: 42 });
    expect(resultado).toEqual({ entidadesCriadas: 1, notasCriadas: 0 });
  });

  it("cria as Notas sugeridas com autoria do agente e grava a proveniência de cada uma", async () => {
    extrairTextoDaFonteMock.mockResolvedValue({ texto: "texto longo", tipoMime: "text/plain" });
    generateContentMock.mockResolvedValue(
      respostaJson({ entidades: [], notas: [{ titulo: "Resumo", conteudo: "# Resumo\n..." }] }),
    );
    criarNotaMock.mockResolvedValue({ id: 99, userId: "user-1", titulo: "Resumo" });

    const resultado = await processarFonte("user-1", 7);

    expect(criarNotaMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        titulo: "Resumo",
        criadoPor: "agente",
        criadoPorFerramenta: "processar_fonte",
      }),
    );
    expect(vincularFonteMock).toHaveBeenCalledWith({ userId: "user-1", fonteId: 7, notaId: 99 });
    expect(resultado).toEqual({ entidadesCriadas: 0, notasCriadas: 1 });
  });

  it("trata listas ausentes na resposta do Gemini como vazias, sem lançar erro", async () => {
    extrairTextoDaFonteMock.mockResolvedValue({ texto: "texto qualquer", tipoMime: "text/plain" });
    generateContentMock.mockResolvedValue(respostaJson({}));

    const resultado = await processarFonte("user-1", 7);

    expect(resultado).toEqual({ entidadesCriadas: 0, notasCriadas: 0 });
    expect(criarEntidadeMock).not.toHaveBeenCalled();
    expect(criarNotaMock).not.toHaveBeenCalled();
  });

  it("lança erro quando o Gemini não devolve texto nenhum", async () => {
    extrairTextoDaFonteMock.mockResolvedValue({ texto: "texto qualquer", tipoMime: "text/plain" });
    generateContentMock.mockResolvedValue({ text: undefined });

    await expect(processarFonte("user-1", 7)).rejects.toThrow(/não devolveu sugestão/);
  });
});
