import { create } from "zustand";
import { alturaMedia } from "./alturaDaFolha";

type EstadoVault = {
  busca: string;
  noSelecionado: string | null;
  // Em pixels. Zero significa "o layout ainda não chegou": a folha só ganha
  // altura real quando `definirLimitesDaFolha` é chamado a partir do onLayout.
  alturaDaFolha: number;
  alturaMinima: number;
  alturaMaxima: number;
  definirBusca: (texto: string) => void;
  selecionarNo: (id: string | null) => void;
  limparSelecao: () => void;
  definirAlturaDaFolha: (altura: number) => void;
  definirLimitesDaFolha: (minima: number, maxima: number) => void;
};

export const useEstadoVault = create<EstadoVault>((set) => ({
  busca: "",
  noSelecionado: null,
  alturaDaFolha: 0,
  alturaMinima: 0,
  alturaMaxima: 0,

  definirBusca: (texto) => set({ busca: texto }),

  selecionarNo: (id) =>
    set((estado) => {
      if (id === null) return { noSelecionado: null };
      // Selecionar um nó filtra a lista para a vizinhança dele; com a bandeja
      // recolhida, o resultado do toque ficaria invisível.
      const media = alturaMedia(estado.alturaMinima, estado.alturaMaxima);
      return { noSelecionado: id, alturaDaFolha: Math.max(estado.alturaDaFolha, media) };
    }),

  limparSelecao: () => set({ noSelecionado: null }),

  definirAlturaDaFolha: (altura) => set({ alturaDaFolha: altura }),

  definirLimitesDaFolha: (minima, maxima) =>
    set((estado) => ({
      alturaMinima: minima,
      alturaMaxima: maxima,
      // Primeira medida abre na média; as seguintes (rotação, fonte do
      // sistema) só reclampam, preservando a altura que o usuário escolheu.
      alturaDaFolha:
        estado.alturaDaFolha === 0
          ? alturaMedia(minima, maxima)
          : Math.min(maxima, Math.max(minima, estado.alturaDaFolha)),
    })),
}));
