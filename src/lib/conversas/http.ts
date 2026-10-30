/** O que as rotas de `/api/conversas` têm em comum: validação do corpo e a tradução dos erros em resposta HTTP. */

import { z } from "zod";
import { respostaDeErro, tratarErroDeRepositorio } from "../http-de-notas";
import { ErroDeConversa, MAXIMO_DE_CARACTERES_DA_MENSAGEM, MAXIMO_DE_MENSAGENS_POR_PEDIDO } from "./tipos";

const esquemaDeFerramenta = z.object({
  nome: z.string().max(100),
  resumo: z.string().max(1_000),
  argumentos: z.record(z.string(), z.unknown()).default({}),
  erro: z.boolean().optional(),
  notaId: z.string().max(100).optional(),
});

const esquemaDeFonte = z.object({ id: z.string().max(100), titulo: z.string().max(500) });

const esquemaDeMensagem = z.object({
  id: z.uuid(),
  papel: z.enum(["usuario", "agente"]),
  conteudo: z.string().min(1).max(MAXIMO_DE_CARACTERES_DA_MENSAGEM),
  ferramentas: z.array(esquemaDeFerramenta).max(100).optional(),
  fontes: z.array(esquemaDeFonte).max(100).optional(),
});

export const esquemaDeAcrescentar = z.object({
  mensagens: z.array(esquemaDeMensagem).min(1).max(MAXIMO_DE_MENSAGENS_POR_PEDIDO),
});

export const esquemaDeIdDeConversa = z.uuid("Identificador de conversa inválido.");

export const SEM_CACHE = { "Cache-Control": "no-store" } as const;

/** 404 e 400 conhecidos viram a frase da camada; o resto é configuração (503) ou erro interno (500, só no log). */
export function tratarErroDeConversas(erro: unknown, contexto: string): Response {
  if (erro instanceof ErroDeConversa) return respostaDeErro(erro.motivo === "nao-encontrada" ? 404 : 400, erro.message);
  return tratarErroDeRepositorio(erro, contexto);
}
