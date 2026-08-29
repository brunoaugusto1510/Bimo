import { create } from "zustand";

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
