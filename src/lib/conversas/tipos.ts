/**
 * O histórico de conversas do chat. Cada conversa é uma lista de mensagens que
 * só cresce: o chat acrescenta (idempotente pelo id da mensagem) e nunca reescreve.
 *
 * O servidor continua sem estado no `/api/chat` — quem monta o histórico que o
 * agente recebe é o cliente. Esta camada só lembra a conversa para reabri-la.
 */

import type { Mensagem, UsoDeFerramenta } from "../types";

export type IdDeConversa = string;

export type ResumoDeConversa = {
  id: IdDeConversa;
  titulo: string;
  /** ISO 8601 (UTC): a hora da última mensagem. */
  atualizadaEm: string;
};

export type ConversaCompleta = { conversa: ResumoDeConversa; mensagens: Mensagem[] };

export interface RepositorioDeConversas {
  /** As conversas mais recentes primeiro. */
  listar(limite?: number): Promise<ResumoDeConversa[]>;
  /** `null` quando a conversa não existe ou é de outra pessoa. */
  obter(id: IdDeConversa): Promise<ConversaCompleta | null>;
  /**
   * Acrescenta ao fim, criando a conversa se ainda não existir. Repetir uma
   * mensagem (mesmo id) não duplica: o pedido pode ser reenviado se a resposta se perdeu.
   * Lança `ErroDeConversa` com `nao-encontrada` se o id já pertence a outra pessoa.
   */
  acrescentar(id: IdDeConversa, mensagens: Mensagem[]): Promise<ResumoDeConversa>;
  /** `false` quando não havia o que apagar. */
  excluir(id: IdDeConversa): Promise<boolean>;
}

export class ErroDeConversa extends Error {
  constructor(readonly motivo: "nao-encontrada" | "invalida", mensagem: string) {
    super(mensagem);
    this.name = "ErroDeConversa";
  }
}

export const LIMITE_DA_LISTA = 50;
export const MAXIMO_DE_MENSAGENS_POR_PEDIDO = 10;
/** Ao reabrir, vêm as mais recentes: o agente só recebe 40 e a tela não precisa de mais que isso. */
export const LIMITE_DE_MENSAGENS_ABERTAS = 200;
export const MAXIMO_DE_CARACTERES_DA_MENSAGEM = 20_000;
export const MAXIMO_DE_CARACTERES_DO_TITULO = 80;

const TITULO_SEM_TEXTO = "Nova conversa";

/** O título nasce da primeira pergunta da pessoa: uma linha, sem quebras, cortada no limite. */
export function tituloDaConversa(mensagens: Pick<Mensagem, "papel" | "conteudo">[]): string {
  const primeira = mensagens.find((m) => m.papel === "usuario") ?? mensagens[0];
  const texto = primeira?.conteudo.replace(/\s+/g, " ").trim() ?? "";
  if (!texto) return TITULO_SEM_TEXTO;
  if (texto.length <= MAXIMO_DE_CARACTERES_DO_TITULO) return texto;
  return `${texto.slice(0, MAXIMO_DE_CARACTERES_DO_TITULO - 1).trimEnd()}…`;
}

/** Confere o que vai ser guardado e devolve a versão enxuta; qualquer defeito vira `ErroDeConversa("invalida")`. */
export function prepararMensagens(mensagens: Mensagem[]): Mensagem[] {
  if (mensagens.length === 0 || mensagens.length > MAXIMO_DE_MENSAGENS_POR_PEDIDO) {
    throw new ErroDeConversa("invalida", `Envie de 1 a ${MAXIMO_DE_MENSAGENS_POR_PEDIDO} mensagens por vez.`);
  }
  for (const m of mensagens) {
    const papelValido = m.papel === "usuario" || m.papel === "agente";
    if (!papelValido || !m.id || m.conteudo.trim() === "" || m.conteudo.length > MAXIMO_DE_CARACTERES_DA_MENSAGEM) {
      throw new ErroDeConversa("invalida", "Mensagem inválida.");
    }
  }
  return mensagens.map(mensagemParaGuardar);
}

/**
 * O que fica guardado de cada ferramenta: só o que a tela usa para mostrar a pílula
 * e abrir a nota. Os argumentos (que podem trazer o texto inteiro de uma nota) ficam de
 * fora — sobra o caminho, que o chat usa para o "Abrir".
 */
function ferramentaParaGuardar(uso: UsoDeFerramenta): UsoDeFerramenta {
  const caminho = uso.argumentos?.caminho;
  return {
    nome: uso.nome,
    resumo: uso.resumo,
    argumentos: typeof caminho === "string" ? { caminho } : {},
    ...(uso.erro ? { erro: true } : {}),
    ...(uso.notaId ? { notaId: uso.notaId } : {}),
  };
}

/** Uma cópia da mensagem só com o que vale guardar. */
export function mensagemParaGuardar(mensagem: Mensagem): Mensagem {
  return {
    id: mensagem.id,
    papel: mensagem.papel,
    conteudo: mensagem.conteudo,
    ...(mensagem.ferramentas?.length ? { ferramentas: mensagem.ferramentas.map(ferramentaParaGuardar) } : {}),
    ...(mensagem.fontes?.length ? { fontes: mensagem.fontes.map(({ id, titulo }) => ({ id, titulo })) } : {}),
  };
}
