import type { Aresta, NoDoGrafo } from "@/dados/tipos";

export type ModoDoGrafo = "ambiente" | "interativo";

export type PropsDoCampoDeGrafo = {
  modo: ModoDoGrafo;
  densidade: number;
  ligado: boolean;
  particulasLigadas: boolean;
  pulso: number;
  crescer: number;
  nos?: NoDoGrafo[];
  arestas?: Aresta[];
  noSelecionado?: string | null;
  aoSelecionarNo?: (id: string | null) => void;
};
