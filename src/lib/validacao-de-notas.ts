/**
 * O que as rotas de notas aceitam, validado na borda com `zod`. Cada esquema
 * devolve já os valores normalizados (título aparado, pasta arrumada, tags sem
 * `#` nem repetição), então o resto do código não revalida.
 */

import { z } from "zod";
import { normalizarPasta, profundidadeDaPasta, validarTitulo } from "./caminho-da-nota";
import { normalizarTags } from "./tags-da-nota";

/** O corpo da requisição já é limitado em 1 MB; isto é o teto do texto de uma nota. */
export const TAMANHO_MAXIMO_DO_CONTEUDO = 1_000_000;
const MAXIMO_DE_TAGS = 30;
const TAMANHO_MAXIMO_DA_TAG = 100;
const TAMANHO_MAXIMO_DA_BUSCA = 200;
const LIMITE_PADRAO_DA_BUSCA = 10;
const LIMITE_MAXIMO_DA_BUSCA = 50;

const titulo = z.string().transform((valor, contexto) => {
  const resultado = validarTitulo(valor);
  if (resultado.ok) return resultado.titulo;

  contexto.issues.push({ code: "custom", message: resultado.motivo, input: valor });
  return z.NEVER;
});

const TAMANHO_MAXIMO_DA_PASTA = 500;
const PROFUNDIDADE_MAXIMA_DA_PASTA = 20;

/**
 * `null`, vazio e "/" são a raiz. Fica opcional por fora: ausente continua ausente (não vira "mover para a raiz").
 * O limite vem antes de qualquer trabalho com o texto: uma pasta de dezenas de milhares de segmentos cabe no corpo de 1 MB.
 */
const pasta = z
  .string()
  .max(TAMANHO_MAXIMO_DA_PASTA, "O caminho da pasta é longo demais.")
  .nullable()
  .transform(normalizarPasta)
  .refine((valor) => profundidadeDaPasta(valor) <= PROFUNDIDADE_MAXIMA_DA_PASTA, {
    message: `Use no máximo ${PROFUNDIDADE_MAXIMA_DA_PASTA} níveis de pasta.`,
  })
  .optional();

const conteudo = z.string().max(TAMANHO_MAXIMO_DO_CONTEUDO, "A nota é grande demais.").optional();

const tags = z
  .array(z.string().max(TAMANHO_MAXIMO_DA_TAG))
  .max(MAXIMO_DE_TAGS, `Use no máximo ${MAXIMO_DE_TAGS} tags.`)
  .transform(normalizarTags)
  .optional();

const revisaoBase = z.number().int().min(0);

export const esquemaDeCriacao = z.object({ titulo, pasta, conteudo, tags });

export const esquemaDeAtualizacao = z.object({
  revisaoBase,
  conteudo,
  pasta,
  tags,
  checkpoint: z.boolean().optional(),
});

export const esquemaDeRenomeacao = z.object({ revisaoBase, titulo });

/**
 * Ids são opacos, mas só de letras, dígitos, `_` e `-`: cabem numa rota e não escapam dela.
 * O teto folgado vem da época em que o id também podia ser um caminho codificado; hoje basta para qualquer id do banco.
 */
export const esquemaDeIdDeNota = z.string().regex(/^[A-Za-z0-9_-]{1,1500}$/, "Identificador de nota inválido.");

export const esquemaDeBusca = z
  .object({
    q: z.string().trim().min(1, "Digite o que buscar.").max(TAMANHO_MAXIMO_DA_BUSCA),
    limite: z
      .string()
      .regex(/^\d+$/)
      .transform(Number)
      .pipe(z.number().int().min(1).max(LIMITE_MAXIMO_DA_BUSCA))
      .optional(),
  })
  .transform(({ q, limite }) => ({ q, limite: limite ?? LIMITE_PADRAO_DA_BUSCA }));

/** A primeira mensagem de erro, no tom que a interface mostra. */
export function mensagemDoPrimeiroErro(erro: z.ZodError): string {
  return erro.issues[0]?.message ?? "Pedido inválido.";
}
