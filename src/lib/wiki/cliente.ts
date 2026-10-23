import type { NotaCompleta } from "../repositorio-de-notas/tipos";
import type { MetadadosWiki } from "./tipos";
import type { EstadoDoNeuronio, EnergiaWiki, EventoWiki } from "./observabilidade-tipos";

export type ResumoDoCerebro = {
  resumo: { neuronios: number; sinapses: number; notasLidas: number; totalDeNotas: number; emConsolidacao: number; impedidas: number };
  energia: EnergiaWiki | null;
  neuronios: { id: string; titulo: string; pasta: string | null; revisao: number; criadoEm: string | null; estado: EstadoDoNeuronio; alertas: string[]; afirmacoes: number; fontes: number }[];
};
export type DetalheDoNeuronio = { nota: NotaCompleta; estado: string; estadoNeuronio: EstadoDoNeuronio; pausada: boolean; alertas: string[]; evidencias: MetadadosWiki };
export type PaginaDoDiario = { eventos: EventoWiki[]; proximo: { criadoEm: string; id: string } | null };
export const ESTADOS_DO_NEURONIO: Record<EstadoDoNeuronio, string> = {
  vivo: "Vivo", reconsolidando: "Reconsolidando", seu: "Seu", em_tensao: "Em tensão", sem_raizes: "Sem raízes", em_pausa: "Em pausa",
};
