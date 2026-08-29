import { create } from "zustand";
import type { Mensagem } from "@/dados/tipos";
import type { ServicoIA } from "@/servicos";
import { mensagensIniciais } from "@/dados/fixtures/mensagens";

function agora(): string {
  return new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function novoId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

type EstadoChat = {
  mensagens: Mensagem[];
  rascunho: string;
  digitando: boolean;
  definirRascunho: (texto: string) => void;
  preencherRascunho: (titulo: string) => void;
  enviar: (ia: ServicoIA, aoPulsar: () => void) => Promise<void>;
};

export const useEstadoChat = create<EstadoChat>((set, get) => ({
  mensagens: mensagensIniciais,
  rascunho: "",
  digitando: false,

  definirRascunho: (texto) => set({ rascunho: texto }),

  preencherRascunho: (titulo) => set({ rascunho: `O que eu já escrevi sobre '${titulo}'?` }),

  enviar: async (ia, aoPulsar) => {
    const texto = get().rascunho.trim();
    if (texto.length === 0) return;

    set((estado) => ({
      mensagens: [...estado.mensagens, { id: novoId(), autor: "usuario", texto, horario: agora() }],
      rascunho: "",
      digitando: true,
    }));
    aoPulsar();

    try {
      const resposta = await ia.conversar(texto);
      set((estado) => ({
        mensagens: [...estado.mensagens, { id: novoId(), autor: "agente", texto: resposta.texto, horario: agora(), cartoes: resposta.cartoes }],
        digitando: false,
      }));
    } catch {
      set((estado) => ({
        mensagens: [...estado.mensagens, { id: novoId(), autor: "agente", texto: "Não consegui consultar o vault agora. Tenta de novo em instantes.", horario: agora() }],
        digitando: false,
      }));
    }

    aoPulsar();
  },
}));
