import { create } from "zustand";
import type { Perfil } from "@/dados/tipos";
import { perfil as perfilInicial } from "@/dados/fixtures/perfil";

export type Interruptores = {
  grafo: boolean;
  particulas: boolean;
  tagsAutomaticas: boolean;
  linksAutomaticos: boolean;
  somenteWifi: boolean;
};

// O handoff original usa 70/90/110. Aqui é 50/60/80: o campo de fundo roda em
// react-native-svg (o @shopify/react-native-skia não funciona no Expo Go), que
// é mais lento que o Skia, então os presets foram reduzidos para compensar.
export type Densidade = 50 | 60 | 80;

type EstadoConta = {
  perfil: Perfil;
  interruptores: Interruptores;
  densidade: Densidade;
  definirPerfil: (perfil: Perfil) => void;
  alternar: (chave: keyof Interruptores) => void;
  definirDensidade: (densidade: Densidade) => void;
};

export const useEstadoConta = create<EstadoConta>((set) => ({
  perfil: perfilInicial,
  interruptores: { grafo: true, particulas: true, tagsAutomaticas: true, linksAutomaticos: false, somenteWifi: true },
  densidade: 60,

  definirPerfil: (perfil) => set({ perfil }),
  alternar: (chave) => set((estado) => ({ interruptores: { ...estado.interruptores, [chave]: !estado.interruptores[chave] } })),
  definirDensidade: (densidade) => set({ densidade }),
}));
