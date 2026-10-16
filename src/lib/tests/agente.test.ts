import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const generateContentMock = vi.fn();

/**
 * Mocka o cliente do Gemini: `new GoogleGenAI(...)` devolve um objeto com
 * `models.generateContent` controlável por teste. Como é uma função mock
 * chamada com `new`, o objeto que ela devolve se torna a instância.
 */
vi.mock("@google/genai", () => ({
  GoogleGenAI: vi.fn().mockImplementation(() => ({
    models: { generateContent: generateContentMock },
  })),
}));

/** As ferramentas de verdade já têm teste próprio (`ferramentas.test.ts`); aqui só o despacho do laço importa. */
vi.mock("../ferramentas", () => ({
  declaracoesDeFerramentas: [],
  executarFerramenta: vi.fn(),
}));

import { executarFerramenta } from "../ferramentas";
import { responder } from "../agente";

function turnoDeTexto(texto: string) {
  return {
    candidates: [{ content: { role: "model", parts: [{ text: texto }] } }],
    functionCalls: [],
    text: texto,
  };
}

function turnoComChamada(nome: string, args: Record<string, unknown>, id = "call-1") {
  // Atenção: não usar o atalho `{ name }` aqui — no ambiente jsdom dos testes
  // existe um `window.name` global (string vazia), que silenciosamente
  // ganharia da variável local se o nome do parâmetro fosse "name".
  return {
    candidates: [{ content: { role: "model", parts: [{ functionCall: { name: nome, args, id } }] } }],
    functionCalls: [{ name: nome, args, id }],
    text: undefined,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.GEMINI_API_KEY = "chave-fake-de-teste";
});

afterEach(() => vi.unstubAllEnvs());

describe("responder", () => {
  it("envia o prompt da fonte configurada e passa notaId sem inventar um commit", async () => {
    vi.stubEnv("NOTAS_FONTE", "memoria");
    generateContentMock
      .mockResolvedValueOnce(turnoComChamada("criar_nota", { caminho: "Nova.md", conteudo: "# Nova" }))
      .mockResolvedValueOnce(turnoDeTexto("Criei Nova.md."));
    vi.mocked(executarFerramenta).mockResolvedValue({
      resposta: { sucesso: true, caminho: "Nova.md" }, resumo: 'Criou a nota "Nova.md"', notaId: "nota-7",
    });
    const resultado = await responder([{ papel: "usuario", conteudo: "crie uma nota" }]);
    expect(resultado.ferramentas[0]).toMatchObject({ notaId: "nota-7" });
    expect(resultado.ferramentas[0].commitUrl).toBeUndefined();
    expect(generateContentMock.mock.calls[0][0].config.systemInstruction).toMatch(/guardadas no Bimo/);
    expect(generateContentMock.mock.calls[0][0].config.systemInstruction).not.toMatch(/commit|GitHub|vault/i);
  });
  it("lança um erro claro se GEMINI_API_KEY não estiver definida", async () => {
    delete process.env.GEMINI_API_KEY;

    await expect(responder([{ papel: "usuario", conteudo: "oi" }])).rejects.toThrow(
      /GEMINI_API_KEY/,
    );
    expect(generateContentMock).not.toHaveBeenCalled();
  });

  it("devolve o texto direto quando o modelo não pede ferramentas", async () => {
    generateContentMock.mockResolvedValueOnce(turnoDeTexto("Resposta direta."));

    const resultado = await responder([{ papel: "usuario", conteudo: "oi" }]);

    expect(resultado).toEqual({ resposta: "Resposta direta.", ferramentas: [] });
    expect(generateContentMock).toHaveBeenCalledTimes(1);
  });

  it("mapeia 'usuario'/'agente' para 'user'/'model' no histórico enviado ao Gemini", async () => {
    generateContentMock.mockResolvedValueOnce(turnoDeTexto("ok"));

    await responder([
      { papel: "usuario", conteudo: "pergunta" },
      { papel: "agente", conteudo: "resposta anterior" },
    ]);

    const { contents } = generateContentMock.mock.calls[0][0];
    expect(contents[0]).toMatchObject({ role: "user" });
    expect(contents[1]).toMatchObject({ role: "model" });
  });

  it("executa a ferramenta pedida e faz uma segunda volta para a resposta final", async () => {
    generateContentMock
      .mockResolvedValueOnce(turnoComChamada("buscar_notas", { consulta: "TCP" }))
      .mockResolvedValueOnce(turnoDeTexto("Resposta final, citando a nota."));

    vi.mocked(executarFerramenta).mockResolvedValue({
      resposta: { encontradas: 1 },
      resumo: 'Buscou "TCP" — 1 nota(s)',
    });

    const resultado = await responder([{ papel: "usuario", conteudo: "o que é TCP?" }]);

    expect(executarFerramenta).toHaveBeenCalledWith("buscar_notas", { consulta: "TCP" }, { leituras: expect.any(Map) });
    expect(generateContentMock).toHaveBeenCalledTimes(2);
    expect(resultado.resposta).toBe("Resposta final, citando a nota.");
    expect(resultado.ferramentas).toEqual([
      { nome: "buscar_notas", argumentos: { consulta: "TCP" }, resumo: 'Buscou "TCP" — 1 nota(s)', erro: undefined },
    ]);
  });

  it("propaga o link do commit quando a ferramenta escreveu no vault", async () => {
    generateContentMock
      .mockResolvedValueOnce(turnoComChamada("criar_nota", { caminho: "Estudos/DNS.md", conteudo: "# DNS" }))
      .mockResolvedValueOnce(turnoDeTexto("Criei a nota Estudos/DNS.md."));

    vi.mocked(executarFerramenta).mockResolvedValue({
      resposta: { sucesso: true, caminho: "Estudos/DNS.md", commit: "https://github.com/usuario/vault/commit/abc" },
      resumo: 'Criou a nota "Estudos/DNS.md"',
    });

    const resultado = await responder([{ papel: "usuario", conteudo: "crie uma nota sobre DNS" }]);

    expect(resultado.ferramentas[0]?.commitUrl).toBe("https://github.com/usuario/vault/commit/abc");
  });

  it("não inventa um commitUrl para ferramentas que não escreveram nada", async () => {
    generateContentMock
      .mockResolvedValueOnce(turnoComChamada("buscar_notas", { consulta: "TCP" }))
      .mockResolvedValueOnce(turnoDeTexto("ok"));

    vi.mocked(executarFerramenta).mockResolvedValue({
      resposta: { encontradas: 0 },
      resumo: 'Buscou "TCP" — nenhuma nota encontrada',
    });

    const resultado = await responder([{ papel: "usuario", conteudo: "o que é TCP?" }]);

    expect(resultado.ferramentas[0]?.commitUrl).toBeUndefined();
  });

  it("registra o uso da ferramenta mesmo quando ela devolve erro, sem interromper o laço", async () => {
    generateContentMock
      .mockResolvedValueOnce(turnoComChamada("ler_nota", { caminho: "Não/Existe.md" }))
      .mockResolvedValueOnce(turnoDeTexto("Não encontrei essa nota."));

    vi.mocked(executarFerramenta).mockResolvedValue({
      resposta: { erro: "Nota não encontrada." },
      resumo: "Nota não encontrada: Não/Existe.md",
      erro: true,
    });

    const resultado = await responder([{ papel: "usuario", conteudo: "leia Não/Existe.md" }]);

    expect(resultado.ferramentas[0]?.erro).toBe(true);
    expect(resultado.resposta).toBe("Não encontrei essa nota.");
  });

  it("para depois de MAX_VOLTAS (5) chamadas seguidas e devolve uma mensagem de desistência", async () => {
    generateContentMock.mockResolvedValue(turnoComChamada("buscar_notas", { consulta: "x" }));
    vi.mocked(executarFerramenta).mockResolvedValue({ resposta: {}, resumo: "ok" });

    const resultado = await responder([{ papel: "usuario", conteudo: "pergunta difícil" }]);

    expect(generateContentMock).toHaveBeenCalledTimes(5);
    expect(resultado.resposta).toMatch(/não cheguei a uma resposta final/);
    expect(resultado.ferramentas).toHaveLength(5);
  });
});

it("compartilha leituras no laço e isola chamadas de responder", async () => {
  vi.stubEnv("NOTAS_FONTE", "memoria");
  generateContentMock.mockResolvedValueOnce(turnoComChamada("ler_nota", { caminho: "TCP" }))
    .mockResolvedValueOnce(turnoComChamada("editar_nota", { caminho: "TCP" }))
    .mockResolvedValueOnce(turnoDeTexto("ok"))
    .mockResolvedValueOnce(turnoComChamada("ler_nota", { caminho: "TCP" }))
    .mockResolvedValueOnce(turnoDeTexto("ok"));
  vi.mocked(executarFerramenta).mockResolvedValue({ resposta: {}, resumo: "ok" });
  await responder([{ papel: "usuario", conteudo: "edite" }]);
  await responder([{ papel: "usuario", conteudo: "leia" }]);
  const chamadas = vi.mocked(executarFerramenta).mock.calls;
  expect(chamadas[0][2]?.leituras).toBeInstanceOf(Map);
  expect(chamadas[0][2]?.leituras).toBe(chamadas[1][2]?.leituras);
  expect(chamadas[0][2]?.leituras).not.toBe(chamadas[2][2]?.leituras);
});
