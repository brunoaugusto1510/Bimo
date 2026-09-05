/**
 * Pipeline de ingestão (Fase 3, Decisão 5 — parte 2): a partir de uma Fonte já
 * gravada, extrai o texto e pede ao Gemini para identificar conceitos
 * (Entidades) e conteúdo digno de nota (Notas); cada uma criada é gravada com
 * sua proveniência apontando de volta pra Fonte.
 *
 * Disparo explícito (`processarFonte` não roda sozinho ao criar a Fonte) —
 * decisão tomada com o usuário: mais previsível, mais fácil de depurar e
 * testar isoladamente, e evita gastar uma chamada ao Gemini toda vez que
 * alguém sobe um arquivo, mesmo sem querer processá-lo ainda.
 *
 * Toda Entidade criada aqui nasce `status: "rascunho"`, nunca `aprovada` — o
 * agente não tem liberdade de aprovar sozinho o que ele mesmo extraiu
 * (Princípio 4 do doc de visão: "o agente não deve possuir liberdade
 * ilimitada"); fica pendente de revisão humana. Nota não tem esse campo de
 * workflow (só Entidade tem — ver comentário em `entidades.ts`), então para
 * Nota a autoria (`criadoPor: "agente"`) já é o sinal equivalente.
 *
 * Usa `responseSchema` (saída estruturada) em vez do laço de function calling
 * de `agente.ts`: aqui não há conversa de ida e volta, é uma extração em lote
 * de uma vez só — pedir JSON validado é mais simples e mais previsível do que
 * simular chamadas de ferramenta pra isso.
 */

import { GoogleGenAI, Type } from "@google/genai";
import { criarEntidade } from "./entidades";
import { extrairTextoDaFonte } from "./extracao";
import { criarNota } from "./notas";
import { vincularFonte } from "./proveniencia";

const MODELO = process.env.GEMINI_MODEL || "gemini-3.5-flash";

/** Vai em `criadoPorFerramenta` — identifica que a origem foi este pipeline, não o chat. */
const NOME_DA_FERRAMENTA = "processar_fonte";

const INSTRUCAO_DO_SISTEMA = `
Você está processando o texto extraído de uma fonte (PDF, página web, Markdown) para
alimentar uma base de conhecimento pessoal. A partir do texto a seguir, identifique:

- Entidades: conceitos, pessoas, ferramentas ou termos técnicos centrais o bastante
  para virarem nós do grafo de conhecimento. Nomes curtos e específicos.
- Notas: se o texto tiver conteúdo substancial o bastante para virar uma nota de
  estudo (resumo, explicação), escreva-a em Markdown, com um título "# " no topo.

Seja seletivo: não crie uma Entidade para cada substantivo do texto, só para o que for
realmente central. Devolver listas vazias é válido e esperado quando o texto for curto
demais ou irrelevante — não invente conteúdo só para preencher a resposta.
`.trim();

const ESQUEMA_RESPOSTA = {
  type: Type.OBJECT,
  properties: {
    entidades: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          nome: { type: Type.STRING },
          tipo: { type: Type.STRING },
          aliases: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["nome"],
      },
    },
    notas: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          titulo: { type: Type.STRING },
          conteudo: { type: Type.STRING },
          tags: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["titulo", "conteudo"],
      },
    },
  },
  required: ["entidades", "notas"],
};

type SugestaoDeIngestao = {
  entidades: Array<{ nome: string; tipo?: string; aliases?: string[] }>;
  notas: Array<{ titulo: string; conteudo: string; tags?: string[] }>;
};

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY não está definida. Pegue uma chave em https://aistudio.google.com/apikey e coloque no .env.",
    );
  }
  return new GoogleGenAI({ apiKey });
}

/** Pede ao Gemini a lista de Entidades/Notas sugeridas a partir do texto já extraído. */
async function sugerirConhecimento(texto: string): Promise<SugestaoDeIngestao> {
  const ai = getClient();
  const resposta = await ai.models.generateContent({
    model: MODELO,
    contents: [{ role: "user", parts: [{ text: texto }] }],
    config: {
      systemInstruction: INSTRUCAO_DO_SISTEMA,
      responseMimeType: "application/json",
      responseSchema: ESQUEMA_RESPOSTA,
      temperature: 0.2,
    },
  });

  const bruto = resposta.text?.trim();
  if (!bruto) {
    throw new Error("O Gemini não devolveu sugestão nenhuma para esta Fonte.");
  }

  const sugestao = JSON.parse(bruto) as Partial<SugestaoDeIngestao>;
  return {
    entidades: sugestao.entidades ?? [],
    notas: sugestao.notas ?? [],
  };
}

export type ResultadoProcessamento = {
  entidadesCriadas: number;
  notasCriadas: number;
};

/**
 * Extrai o texto da Fonte, pede ao Gemini a sugestão de Entidades/Notas, cria
 * cada uma (Entidade sempre como "rascunho") e grava a proveniência de volta
 * pra Fonte.
 */
export async function processarFonte(userId: string, fonteId: number): Promise<ResultadoProcessamento> {
  const { texto } = await extrairTextoDaFonte(userId, fonteId);

  if (!texto.trim()) {
    return { entidadesCriadas: 0, notasCriadas: 0 };
  }

  const sugestao = await sugerirConhecimento(texto);

  for (const entidade of sugestao.entidades) {
    const criada = await criarEntidade({
      userId,
      nome: entidade.nome,
      tipo: entidade.tipo,
      aliases: entidade.aliases,
      status: "rascunho",
      criadoPor: "agente",
      criadoPorFerramenta: NOME_DA_FERRAMENTA,
    });
    await vincularFonte({ userId, fonteId, entidadeId: criada.id });
  }

  for (const nota of sugestao.notas) {
    const criada = await criarNota({
      userId,
      titulo: nota.titulo,
      conteudo: nota.conteudo,
      tags: nota.tags,
      criadoPor: "agente",
      criadoPorFerramenta: NOME_DA_FERRAMENTA,
    });
    await vincularFonte({ userId, fonteId, notaId: criada.id });
  }

  return {
    entidadesCriadas: sugestao.entidades.length,
    notasCriadas: sugestao.notas.length,
  };
}
