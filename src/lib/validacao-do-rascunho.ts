import { z } from "zod";

export const TAMANHO_MAXIMO_DO_TITULO = 200;
export const TAMANHO_MAXIMO_DO_ANTES = 4000;
export const TAMANHO_MAXIMO_DO_DEPOIS = 2000;
export const TAMANHO_MAXIMO_DO_TRECHO = 8000;

function textoLimitado(maximo: number, campo: string) {
  return z.string({ error: `O campo ${campo} deve ser texto.` })
    .max(maximo, `O campo ${campo} deve ter no máximo ${maximo} caracteres.`).trim();
}

export const esquemaDeRascunho = z.object({
  acao: z.enum(["continuar", "resumir", "melhorar"], { error: "Escolha continuar, resumir ou melhorar." }),
  titulo: textoLimitado(TAMANHO_MAXIMO_DO_TITULO, "título"),
  antes: textoLimitado(TAMANHO_MAXIMO_DO_ANTES, "antes"),
  depois: textoLimitado(TAMANHO_MAXIMO_DO_DEPOIS, "depois"),
  trecho: textoLimitado(TAMANHO_MAXIMO_DO_TRECHO, "trecho"),
}).superRefine((pedido, contexto) => {
  if (pedido.acao === "continuar") {
    if (pedido.trecho !== "") contexto.addIssue({ code: "custom", path: ["trecho"], message: "Para continuar, deixe o trecho vazio." });
    if (!pedido.antes) contexto.addIssue({ code: "custom", path: ["antes"], message: "Escreva algum texto antes de continuar." });
  } else if (!pedido.trecho) {
    contexto.addIssue({ code: "custom", path: ["trecho"], message: "Selecione um trecho para resumir ou melhorar." });
  }
});

export type PedidoDeRascunho = z.infer<typeof esquemaDeRascunho>;
