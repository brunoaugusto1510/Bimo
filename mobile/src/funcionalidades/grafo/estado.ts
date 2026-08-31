import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { VERSAO_DO_LAYOUT, type LayoutPersistido } from "./layoutPersistido";

type EstadoGrafo = {
  pulso: number;
  crescer: number;
  pulsar: () => void;
  crescerNo: () => void;
};

export const useEstadoGrafo = create<EstadoGrafo>((set) => ({
  pulso: 0,
  crescer: 0,
  pulsar: () => set((estado) => ({ pulso: estado.pulso + 1 })),
  crescerNo: () => set((estado) => ({ crescer: estado.crescer + 1 })),
}));

type EstadoLayout = LayoutPersistido & {
  guardarLayout: (parcial: Partial<Omit<LayoutPersistido, "versao">>) => void;
};

// Store separado do `useEstadoGrafo` de propósito: pulso e crescer são estado
// efêmero de animação e não têm o que fazer no disco. Aqui vai só o layout que
// o usuário arrumou com o dedo.
export const useEstadoLayoutDoGrafo = create<EstadoLayout>()(
  persist(
    (set) => ({
      versao: VERSAO_DO_LAYOUT,
      posicoes: {},
      zoom: 1,
      deslocamentoX: 0,
      deslocamentoY: 0,
      alturaDaFolha: 0,
      guardarLayout: (parcial) => set(parcial),
    }),
    {
      name: "bimo-layout-do-grafo",
      storage: createJSONStorage(() => AsyncStorage),
      // A função não vai para o disco; só os dados.
      partialize: ({ versao, posicoes, zoom, deslocamentoX, deslocamentoY, alturaDaFolha }) => ({
        versao,
        posicoes,
        zoom,
        deslocamentoX,
        deslocamentoY,
        alturaDaFolha,
      }),
    },
  ),
);
