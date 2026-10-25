import "server-only";
import { z } from "zod";

export type ItemDaResposta = { type: string; [campo: string]: unknown };
export type PedidoOpenAI = {
  instructions: string;
  input: Record<string, unknown>[];
  tools: Record<string, unknown>[];
  tool_choice?: "none";
  text?: { format: { type: "json_schema"; name: string; strict: true; schema: Record<string, unknown> } };
};

const esquemaDaResposta = z.object({
  status: z.string(),
  output: z.array(z.object({ type: z.string() }).passthrough()),
  usage: z.object({
    input_tokens: z.number().int().nonnegative(),
    output_tokens: z.number().int().nonnegative(),
    input_tokens_details: z.object({ cached_tokens: z.number().int().nonnegative() }).optional(),
    output_tokens_details: z.object({ reasoning_tokens: z.number().int().nonnegative() }).optional(),
  }).optional(),
});

export class ErroOpenAI extends Error {
  override name = "ErroOpenAI";
  constructor(readonly status: number) { super(`Falha na API OpenAI (HTTP ${status}).`); }
}

/** Transporte do servidor, sem repetição automática: uma ferramenta pode já ter gravado uma nota. */
export async function criarRespostaOpenAI(pedido: PedidoOpenAI, sinal: AbortSignal) {
  const chave = process.env.OPENAI_API_KEY?.trim();
  if (!chave) throw new Error("OPENAI_API_KEY não está definida.");
  sinal.throwIfAborted();
  const modelo = process.env.OPENAI_MODEL?.trim() || "gpt-6-luna";
  let resposta: Response;
  try {
    resposta = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        ...pedido,
        model: modelo,
        reasoning: { effort: "low" },
        store: false,
        parallel_tool_calls: false,
        max_output_tokens: 4096,
      }),
      signal: sinal,
      cache: "no-store",
      redirect: "error",
    });
  } catch {
    sinal.throwIfAborted();
    throw new Error("Falha de conexão com a API OpenAI.");
  }
  if (!resposta.ok) {
    await resposta.body?.cancel();
    throw new ErroOpenAI(resposta.status);
  }
  let corpo: unknown;
  try {
    corpo = await resposta.json();
  } catch {
    // O corpo também pode ser interrompido depois de os cabeçalhos chegarem.
    sinal.throwIfAborted();
    throw new Error("Resposta inválida da API OpenAI.");
  }
  const dados = esquemaDaResposta.safeParse(corpo);
  if (!dados.success) throw new Error("Resposta inválida da API OpenAI.");
  if (dados.data.usage) {
    const uso = dados.data.usage;
    // Só metadados de consumo; nunca registrar prompts, argumentos, notas ou chave.
    console.info("[openai] Consumo da chamada", {
      modelo, entrada: uso.input_tokens, saida: uso.output_tokens,
      cache: uso.input_tokens_details?.cached_tokens ?? 0,
      raciocinio: uso.output_tokens_details?.reasoning_tokens ?? 0,
    });
  }
  return dados.data;
}
