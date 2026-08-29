import { create } from "zustand";

export type PassoDaFolha = 0 | 1 | 2;

type EstadoVault = {
  busca: string;
  noSelecionado: string | null;
  passoDaFolha: PassoDaFolha;
  definirBusca: (texto: string) => void;
  selecionarNo: (id: string | null) => void;
  limparSelecao: () => void;
  avancarPasso: () => void;
};

export const useEstadoVault = create<EstadoVault>((set) => ({
  busca: "",
  noSelecionado: null,
  passoDaFolha: 1,

  definirBusca: (texto) => set({ busca: texto }),

  selecionarNo: (id) =>
    set((estado) => ({
      noSelecionado: id,
      passoDaFolha: id === null ? estado.passoDaFolha : (Math.max(1, estado.passoDaFolha) as PassoDaFolha),
    })),

  limparSelecao: () => set({ noSelecionado: null }),

  avancarPasso: () => set((estado) => ({ passoDaFolha: (((estado.passoDaFolha + 1) % 3) as PassoDaFolha) })),
}));
