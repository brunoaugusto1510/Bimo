import { afterEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { gerarConhecimentoWiki } from "./gerador";
import { criarRespostaOpenAI } from "../openai";
import { ErroDaGeracaoWiki } from "./tipos";
vi.mock("../openai", () => ({ criarRespostaOpenAI: vi.fn() }));
afterEach(() => vi.resetAllMocks());
const contexto = { origem: { id: "1", titulo: "A", pasta: null, revisao: 1, conteudo: "segredo fora do trecho" },
  trecho: { inicio: 0, fim: 4, texto: "dado" }, candidatas: [], dependentes: [], indice: { total: 1, entradas: [{ id: "7", titulo: "Síntese existente", aliases: ["apelido"], protegida: false }] } };
const usage = { input_tokens: 100, output_tokens: 50 };
const resposta = (status: string, content: unknown[]) => ({ status, output: [{ type: "message", content }], usage });

it("descoberta usa schema estrito, envia somente o trecho atual e devolve consumo real", async () => {
  vi.mocked(criarRespostaOpenAI).mockResolvedValue(resposta("completed", [{ type: "output_text", text: '{"propostas":[]}' }]));
  const r = await gerarConhecimentoWiki(contexto, new AbortController().signal);
  expect(r).toEqual({ proposta: { propostas: [] }, uso: { entrada: 100, saida: 50 } });
  const enviado = vi.mocked(criarRespostaOpenAI).mock.calls[0][0];
  expect(enviado).toMatchObject({ tools: [], text: { format: { type: "json_schema", strict: true } } });
  expect(JSON.stringify(enviado)).not.toContain("segredo fora do trecho");
  expect(enviado.instructions).toContain("não confiáveis");
  expect(enviado.input[0]).toMatchObject({ role: "user" });
  // O índice vai no payload e as instruções mandam consultá-lo antes de criar um conceito novo.
  expect(JSON.parse((enviado.input[0] as { content: string }).content).indice.entradas[0]).toMatchObject({ id: "7", titulo: "Síntese existente" });
  expect(enviado.instructions).toContain("indice");
});

it("o schema enviado ao modelo é estrito e exige as operações de manter, substituir e retirar", async () => {
  vi.mocked(criarRespostaOpenAI).mockResolvedValue(resposta("completed", [{ type: "output_text", text: '{"propostas":[]}' }]));
  await gerarConhecimentoWiki(contexto, new AbortController().signal);
  const schema = (vi.mocked(criarRespostaOpenAI).mock.calls[0][0].text as unknown as { format: { schema: { properties: { propostas: { items: { required: string[]; additionalProperties: boolean; properties: Record<string, unknown> } } } } } }).format.schema;
  const proposta = schema.properties.propostas.items;
  expect(proposta.additionalProperties).toBe(false);
  // Em modo estrito todo campo é obrigatório; os que têm padrão no servidor também precisam estar no schema.
  expect(proposta.required).toEqual(expect.arrayContaining(["afirmacoes", "substituicoes", "retiradas", "ligacoes", "lacunas"]));
  expect(Object.keys(proposta.properties)).toEqual(expect.arrayContaining(["substituicoes", "retiradas"]));
  // `default` é do zod, não do contrato com o modelo, e o modo estrito não o garante: nada dele no schema enviado.
  expect(JSON.stringify(schema)).not.toContain('"default"');
  // A afirmação aninhada em substituicoes também é estrita.
  const aninhada = (proposta.properties.substituicoes as { items: { required: string[]; additionalProperties: boolean; properties: { afirmacao: { additionalProperties: boolean; required: string[] } } } }).items;
  expect(aninhada.additionalProperties).toBe(false);
  expect(aninhada.properties.afirmacao.additionalProperties).toBe(false);
  expect(aninhada.properties.afirmacao.required).toEqual(expect.arrayContaining(["texto", "natureza", "evidencias"]));
  const instrucoes = vi.mocked(criarRespostaOpenAI).mock.calls[0][0].instructions;
  for (const palavra of ["substituicoes", "retiradas", "limiteDeAfirmacoes", "ligacoes", "lacunas"]) expect(instrucoes).toContain(palavra);
});

it.each(["incomplete", "failed"])("resposta %s vira erro que carrega o uso já cobrado", async (status) => {
  vi.mocked(criarRespostaOpenAI).mockResolvedValue(resposta(status, []));
  const erro = await gerarConhecimentoWiki(contexto, new AbortController().signal).catch((e: unknown) => e);
  expect(erro).toBeInstanceOf(ErroDaGeracaoWiki);
  expect((erro as ErroDaGeracaoWiki).uso).toEqual({ entrada: 100, saida: 50 });
});

it("recusa explícita e JSON inválido também carregam o uso", async () => {
  for (const content of [[{ type: "refusal", refusal: "não" }], [{ type: "output_text", text: "{" }]]) {
    vi.mocked(criarRespostaOpenAI).mockResolvedValue(resposta("completed", content));
    const erro = await gerarConhecimentoWiki(contexto, new AbortController().signal).catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ErroDaGeracaoWiki);
    expect((erro as ErroDaGeracaoWiki).uso).toEqual({ entrada: 100, saida: 50 });
  }
});

it("sem medição na resposta, o uso é desconhecido e a reserva inteira permanece comprometida", async () => {
  vi.mocked(criarRespostaOpenAI).mockResolvedValue({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: '{"propostas":[]}' }] }] });
  expect((await gerarConhecimentoWiki(contexto, new AbortController().signal)).uso).toBeNull();
});

it("o resultado já cobrado não é descartado por um cancelamento tardio", async () => {
  const controle = new AbortController();
  vi.mocked(criarRespostaOpenAI).mockImplementation(async () => { controle.abort(); return resposta("completed", [{ type: "output_text", text: '{"propostas":[]}' }]); });
  await expect(gerarConhecimentoWiki(contexto, controle.signal)).resolves.toMatchObject({ proposta: { propostas: [] } });
});
