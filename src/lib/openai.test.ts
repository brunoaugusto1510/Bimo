import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { criarRespostaOpenAI } from "./openai";

vi.mock("server-only", () => ({}));

const buscar = vi.fn();
const pedido = { instructions: "Consulte as notas.", input: [{ role: "user", content: "oi" }], tools: [] };
beforeEach(() => {
  vi.stubGlobal("fetch", buscar);
  vi.stubEnv("OPENAI_API_KEY", "chave-falsa");
  vi.stubEnv("OPENAI_MODEL", "");
  buscar.mockReset();
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

it("usa Luna e os limites com chave somente no cabeçalho", async () => {
  buscar.mockResolvedValue(Response.json({ status: "completed", output: [] }));
  await criarRespostaOpenAI(pedido, new AbortController().signal);
  const [url, opcoes] = buscar.mock.calls[0];
  expect(url).toBe("https://api.openai.com/v1/responses");
  expect(opcoes.headers.Authorization).toBe("Bearer chave-falsa");
  expect(JSON.parse(opcoes.body)).toMatchObject({ model: "gpt-6-luna", store: false, reasoning: { effort: "low" }, parallel_tool_calls: false, max_output_tokens: 4096 });
  expect(opcoes.body).not.toMatch(/chave-falsa|temperature/);
});

it("usa modelo configurado no servidor", async () => {
  vi.stubEnv("OPENAI_MODEL", "gpt-6-luna");
  buscar.mockResolvedValue(Response.json({ status: "completed", output: [] }));
  await criarRespostaOpenAI(pedido, new AbortController().signal);
  expect(JSON.parse(buscar.mock.calls[0][1].body).model).toBe("gpt-6-luna");
});

it("recusa chave ausente antes de acessar a rede", async () => {
  vi.stubEnv("OPENAI_API_KEY", " ");
  await expect(criarRespostaOpenAI(pedido, new AbortController().signal)).rejects.toThrow(/OPENAI_API_KEY/);
  expect(buscar).not.toHaveBeenCalled();
});

it.each([401, 429, 500])("não repete HTTP %s nem expõe o corpo do erro", async (status) => {
  buscar.mockResolvedValue(Response.json({ error: { message: "segredo SQL" } }, { status }));
  await expect(criarRespostaOpenAI(pedido, new AbortController().signal)).rejects.toThrow(/^Falha na API OpenAI/);
  expect(buscar).toHaveBeenCalledTimes(1);
});

it("recusa resposta sem contrato válido", async () => {
  buscar.mockResolvedValue(Response.json({ segredo: "conteúdo" }));
  await expect(criarRespostaOpenAI(pedido, new AbortController().signal)).rejects.toThrow(/Resposta inválida/);
});

it("encaminha cancelamento ao transporte", async () => {
  const controlador = new AbortController();
  buscar.mockResolvedValue(Response.json({ status: "completed", output: [] }));
  await criarRespostaOpenAI(pedido, controlador.signal);
  expect(buscar.mock.calls[0][1].signal).toBe(controlador.signal);
});

it("registra somente consumo, sem chave nem conteúdo das notas", async () => {
  const registrar = vi.spyOn(console, "info").mockImplementation(() => {});
  buscar.mockResolvedValue(Response.json({ status: "completed", output: [], usage: {
    input_tokens: 100, output_tokens: 40,
    input_tokens_details: { cached_tokens: 20 }, output_tokens_details: { reasoning_tokens: 30 },
  } }));
  try {
    await criarRespostaOpenAI({ ...pedido, instructions: "nota confidencial" }, new AbortController().signal);
    expect(registrar).toHaveBeenCalledWith("[openai] Consumo da chamada", {
      modelo: "gpt-6-luna", entrada: 100, saida: 40, cache: 20, raciocinio: 30,
    });
    expect(JSON.stringify(registrar.mock.calls)).not.toMatch(/confidencial|chave-falsa/);
  } finally { registrar.mockRestore(); }
});
