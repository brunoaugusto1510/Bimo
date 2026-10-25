/** O Luna decide quais ferramentas pedir; o Bimo controla o acesso e a escrita das notas. */
import { z } from "zod";
import { executarFerramenta, type SaidaFerramenta } from "./ferramentas";
import { ferramentasOpenAI } from "./ferramentas-openai";
import { criarRespostaOpenAI, type ItemDaResposta } from "./openai";
import { gerarInstrucaoDoSistema } from "./instrucao-do-agente";
import type { IdDeNota, Mensagem, UsoDeFerramenta } from "./types";

// Busca + leituras + escrita precisam de várias voltas; a última é só para concluir.
const MAX_VOLTAS = 12;
const TEMPO_MAXIMO_MS = 150_000;
const MAX_CARACTERES_DE_CONTEXTO = 200_000;
const esquemaDaChamada = z.object({
  type: z.literal("function_call"), call_id: z.string().min(1),
  name: z.string().min(1), arguments: z.string(),
});
const esquemaDaMensagem = z.object({
  content: z.array(z.discriminatedUnion("type", [
    z.object({ type: z.literal("output_text"), text: z.string() }),
    z.object({ type: z.literal("refusal"), refusal: z.string() }),
  ])),
});

export type ResultadoAgente = {
  resposta: string;
  ferramentas: UsoDeFerramenta[];
};

/** Um passo do agente, emitido assim que a ferramenta termina. `ids` é só para a interface. */
export type PassoDoServidor = {
  ferramenta: UsoDeFerramenta;
  ids: IdDeNota[];
};

export type OpcoesDoAgente = {
  signal?: AbortSignal;
  /** Chamado logo após cada ferramenta rodar. Se lançar, o erro é ignorado: o laço não depende de quem ouve. */
  aoPasso?: (passo: PassoDoServidor) => void;
};

/** Quem ouve os passos (um cliente que caiu, por exemplo) não pode derrubar o agente. */
function avisarPasso(aoPasso: OpcoesDoAgente["aoPasso"], passo: PassoDoServidor): void {
  try {
    aoPasso?.(passo);
  } catch {
    // Ignorado de propósito.
  }
}

/** Validação também no agente, para chamadas internas não contornarem os limites da rota. */
export function historicoPermitido(mensagens: Array<Pick<Mensagem, "papel" | "conteudo">>): boolean {
  return mensagens.length > 0 && mensagens.length <= 40
    && mensagens.every((m) => m.conteudo.length <= 20_000)
    && mensagens.reduce((total, m) => total + m.conteudo.length, 0) <= 80_000;
}

function textoDaResposta(output: ItemDaResposta[]): string {
  const textos: string[] = [];
  for (const item of output) {
    if (item.type !== "message") continue;
    const mensagem = esquemaDaMensagem.parse(item);
    for (const parte of mensagem.content) {
      if (parte.type === "refusal") throw new Error("O modelo recusou o pedido.");
      textos.push(parte.text);
    }
  }
  return textos.join("\n").trim();
}

export async function responder(
  mensagens: Array<Pick<Mensagem, "papel" | "conteudo">>,
  opcoes: OpcoesDoAgente = {},
): Promise<ResultadoAgente> {
  if (!process.env.OPENAI_API_KEY?.trim()) throw new Error("OPENAI_API_KEY não está definida.");
  if (!historicoPermitido(mensagens)) throw new Error("O histórico ultrapassa os limites do chat.");
  const controle = new AbortController();
  const cancelar = () => controle.abort();
  opcoes.signal?.addEventListener("abort", cancelar, { once: true });
  if (opcoes.signal?.aborted) cancelar();
  const temporizador = setTimeout(() => controle.abort(new DOMException("O prazo do agente esgotou.", "TimeoutError")), TEMPO_MAXIMO_MS);
  const input: Record<string, unknown>[] = mensagens.map((m) => ({
    role: m.papel === "agente" ? "assistant" : "user", content: m.conteudo,
  }));
  const ferramentasUsadas: UsoDeFerramenta[] = [];
  const leituras = new Map<IdDeNota, number>();
  const chamadasVistas = new Set<string>();
  const escritas = new Map<string, SaidaFerramenta>();
  try {
    for (let volta = 0; volta < MAX_VOLTAS; volta++) {
      const ultimaVolta = volta === MAX_VOLTAS - 1;
      controle.signal.throwIfAborted();
      if (JSON.stringify(input).length > MAX_CARACTERES_DE_CONTEXTO) {
        throw new Error("O contexto ultrapassou o limite. Faça uma consulta mais específica.");
      }
      const resposta = await criarRespostaOpenAI({
        instructions: gerarInstrucaoDoSistema(), input: [...input], tools: ferramentasOpenAI,
        ...(ultimaVolta ? { tool_choice: "none" as const } : {}),
      }, controle.signal);
      controle.signal.throwIfAborted();
      // Não executar chamadas parciais, mesmo se a resposta incluir texto ou argumentos válidos.
      if (resposta.status !== "completed") throw new Error("O modelo não concluiu a resposta.");
      const texto = textoDaResposta(resposta.output);
      const chamadas = resposta.output.filter((item) => item.type === "function_call").map((item) => esquemaDaChamada.parse(item));
      if (!chamadas.length) {
        if (!texto) throw new Error("O modelo não devolveu texto.");
        return { resposta: texto, ferramentas: ferramentasUsadas };
      }
      // Mesmo se o provedor ignorar tool_choice, nenhuma nova ação cabe nesta volta.
      if (ultimaVolta) break;
      // Reenviar todos os itens, inclusive raciocínio criptografado, durante esta execução.
      input.push(...resposta.output);
      for (const chamada of chamadas) {
        controle.signal.throwIfAborted();
        if (chamadasVistas.has(chamada.call_id)) throw new Error("O modelo repetiu uma chamada já processada.");
        chamadasVistas.add(chamada.call_id);
        const bruto = z.record(z.string(), z.unknown()).parse(JSON.parse(chamada.arguments));
        const argumentos = Object.fromEntries(Object.entries(bruto).filter(([, valor]) => valor !== null));
        const ehEscrita = chamada.name === "criar_nota" || chamada.name === "editar_nota";
        const assinatura = JSON.stringify([chamada.name, Object.entries(argumentos).sort(([a], [b]) => a.localeCompare(b))]);
        let saida = ehEscrita ? escritas.get(assinatura) : undefined;
        if (!saida) {
          saida = await executarFerramenta(chamada.name, argumentos, { leituras });
          if (ehEscrita) escritas.set(assinatura, saida);
          const uso: UsoDeFerramenta = {
            nome: chamada.name, argumentos, resumo: saida.resumo, erro: saida.erro,
            ...(saida.notaId ? { notaId: saida.notaId } : {}),
          };
          ferramentasUsadas.push(uso);
          avisarPasso(opcoes.aoPasso, { ferramenta: uso, ids: saida.ids ?? [] });
        }
        input.push({ type: "function_call_output", call_id: chamada.call_id, output: JSON.stringify(saida.resposta) });
      }
    }
    return {
      resposta: "Atingi o limite de etapas deste pedido. Confira as ações concluídas acima e divida o restante em um pedido menor.",
      ferramentas: ferramentasUsadas,
    };
  } finally {
    clearTimeout(temporizador);
    opcoes.signal?.removeEventListener("abort", cancelar);
  }
}
