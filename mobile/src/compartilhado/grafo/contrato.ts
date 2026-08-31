import type { Aresta, NoDoGrafo } from "@/dados/tipos";
import type { Posicao } from "./posicionamento";

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
  // Só o modo "interativo" usa estes dois: o layout que veio do disco e o
  // aviso de que a simulação assentou e vale gravar de novo.
  posicoesIniciais?: Record<string, Posicao>;
  aoAssentarLayout?: (posicoes: Posicao[]) => void;
};
