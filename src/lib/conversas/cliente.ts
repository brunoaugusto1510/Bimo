/**
 * O chat falando com `/api/conversas`. É uma interface (`ClienteDeConversas`) para o `Chat`
 * poder receber uma versão falsa nos testes — e não guardar nada quando ela não vem.
 */

import type { Mensagem } from "../types";
import type { ConversaCompleta, IdDeConversa, ResumoDeConversa } from "./tipos";

export type ClienteDeConversas = {
  listar(): Promise<ResumoDeConversa[]>;
  abrir(id: IdDeConversa): Promise<ConversaCompleta>;
  acrescentar(id: IdDeConversa, mensagens: Mensagem[]): Promise<void>;
  excluir(id: IdDeConversa): Promise<void>;
};

async function conferir(resposta: Response, falha: string): Promise<Response> {
  if (resposta.ok) return resposta;
  const corpo: unknown = await resposta.json().catch(() => null);
  const erro = typeof corpo === "object" && corpo !== null && "erro" in corpo ? (corpo as { erro: unknown }).erro : null;
  throw new Error(typeof erro === "string" && erro ? erro : falha);
}

export const clienteDeConversas: ClienteDeConversas = {
  async listar() {
    const resposta = await conferir(await fetch("/api/conversas"), "Não consegui carregar o histórico.");
    return ((await resposta.json()) as { conversas: ResumoDeConversa[] }).conversas;
  },

  async abrir(id) {
    const resposta = await conferir(await fetch(`/api/conversas/${encodeURIComponent(id)}`), "Não consegui abrir a conversa.");
    return (await resposta.json()) as ConversaCompleta;
  },

  async acrescentar(id, mensagens) {
    await conferir(
      await fetch(`/api/conversas/${encodeURIComponent(id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mensagens: mensagens.map(({ id: idDaMensagem, papel, conteudo, ferramentas, fontes }) => ({ id: idDaMensagem, papel, conteudo, ferramentas, fontes })),
        }),
      }),
      "Não consegui guardar a conversa no histórico.",
    );
  },

  async excluir(id) {
    await conferir(await fetch(`/api/conversas/${encodeURIComponent(id)}`, { method: "DELETE" }), "Não consegui apagar a conversa.");
  },
};
