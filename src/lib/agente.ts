/**
 * O laço do agente: conversa com o Gemini até ele parar de pedir ferramentas.
 *
 * O fluxo é sempre o mesmo:
 *
 *   1. mandamos o histórico da conversa para o Gemini
 *   2. ele responde com texto (acabou) OU com chamadas de ferramenta
 *   3. executamos as ferramentas e devolvemos os resultados
 *   4. volta pro passo 1
 *
 * Ou seja: o modelo decide *o quê* fazer, o nosso código decide *como* e
 * mantém o controle sobre tudo que toca as notas de verdade.
 */

import {
  GoogleGenAI,
  type Content,
  type Part,
} from "@google/genai";
import { declaracoesDeFerramentas, executarFerramenta } from "./ferramentas";
import { gerarInstrucaoDoSistema } from "./instrucao-do-agente";
import { lerConfiguracaoDeNotas } from "./repositorio-de-notas/config";
import type { IdDeNota, Mensagem, UsoDeFerramenta } from "./types";

/** Trava de segurança: sem isso um modelo confuso pediria ferramentas para sempre. */
const MAX_VOLTAS = 5;

const MODELO = process.env.GEMINI_MODEL || "gemini-3.5-flash";

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY não está definida. Pegue uma chave em https://aistudio.google.com/apikey e coloque no .env.local",
    );
  }
  return new GoogleGenAI({ apiKey });
}

/** Converte o histórico do nosso formato para o formato do Gemini. */
function paraContents(mensagens: Array<Pick<Mensagem, "papel" | "conteudo">>): Content[] {
  return mensagens.map((m) => ({
    // No Gemini o assistente se chama "model", não "assistant"/"agente".
    role: m.papel === "agente" ? "model" : "user",
    parts: [{ text: m.conteudo }],
  }));
}

export type ResultadoAgente = {
  resposta: string;
  ferramentas: UsoDeFerramenta[];
};

export async function responder(
  mensagens: Array<Pick<Mensagem, "papel" | "conteudo">>,
): Promise<ResultadoAgente> {
  const ai = getClient();
  const instrucao = gerarInstrucaoDoSistema(lerConfiguracaoDeNotas().fonte);
  const contents = paraContents(mensagens);
  const ferramentasUsadas: UsoDeFerramenta[] = [];
  const leituras = new Map<IdDeNota, number>();

  for (let volta = 0; volta < MAX_VOLTAS; volta++) {
    const resposta = await ai.models.generateContent({
      model: MODELO,
      contents,
      config: {
        systemInstruction: instrucao,
        tools: [{ functionDeclarations: declaracoesDeFerramentas }],
        // Nós mesmos executamos as ferramentas, no laço abaixo.
        automaticFunctionCalling: { disable: true },
        temperature: 0.4,
      },
    });

    // Guardamos o turno do modelo exatamente como veio, sem remontar: partes
    // internas do raciocínio precisam voltar intactas na próxima chamada.
    const turnoDoModelo = resposta.candidates?.[0]?.content;
    if (turnoDoModelo) contents.push(turnoDoModelo);

    const chamadas = resposta.functionCalls ?? [];

    if (chamadas.length === 0) {
      return {
        resposta: resposta.text?.trim() || "(o modelo não devolveu texto)",
        ferramentas: ferramentasUsadas,
      };
    }

    // Uma resposta por chamada, na mesma ordem em que foram pedidas.
    const partesDeResposta: Part[] = [];

    for (const chamada of chamadas) {
      if (!chamada.name) continue;

      const argumentos = chamada.args ?? {};
      const saida = await executarFerramenta(chamada.name, argumentos, { leituras });

      ferramentasUsadas.push({
        nome: chamada.name,
        argumentos,
        resumo: saida.resumo,
        erro: saida.erro,
        ...(saida.notaId ? { notaId: saida.notaId } : {}),
        // As ferramentas de escrita devolvem o commit em `resposta.commit`
        // (ver ferramentas.ts); as demais simplesmente não têm essa chave.
        commitUrl:
          typeof saida.resposta.commit === "string" ? saida.resposta.commit : undefined,
      });

      partesDeResposta.push({
        functionResponse: {
          // O id só existe em algumas respostas; quando existe, tem que voltar.
          ...(chamada.id ? { id: chamada.id } : {}),
          name: chamada.name,
          response: saida.resposta,
        },
      });
    }

    contents.push({ role: "user", parts: partesDeResposta });
  }

  return {
    resposta:
      "Consultei as notas várias vezes seguidas e não cheguei a uma resposta final. " +
      "Tente reformular a pergunta de forma mais específica.",
    ferramentas: ferramentasUsadas,
  };
}
