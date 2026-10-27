import type { ResumoDoCerebro } from "@/lib/wiki/cliente";
import { pedeAtencao } from "@/lib/wiki/observabilidade-tipos";

/** Os chips do cérebro: "Tudo", "Só neurônios", "Nascidos esta semana" e "Precisam de você". */
export type FiltroDoCerebro = "tudo" | "neuronios" | "novos" | "atencao";
type Neuronio = ResumoDoCerebro["neuronios"][number];

const SEMANA_MS = 7 * 86_400_000;

export const nasceuNaSemana = (n: Neuronio, agora: number) => Boolean(n.criadoEm) && agora - Date.parse(n.criadoEm!) < SEMANA_MS;
/** Precisa de você: tem alerta que pede atenção, ou saiu dos estados em que o Bimo segue sozinho. */
export const precisaDeVoce = (n: Neuronio) => n.alertas.some(pedeAtencao) || !["vivo", "reconsolidando"].includes(n.estado);

/**
 * Ids que o grafo mostra para o filtro. `null` quando o filtro não recorta por
 * id: "Tudo" mostra tudo e "Só neurônios" mostra todos os neurônios.
 */
export function neuroniosDoFiltro(neuronios: readonly Neuronio[], filtro: FiltroDoCerebro, agora: number): ReadonlySet<string> | null {
  if (filtro === "novos") return new Set(neuronios.filter((n) => nasceuNaSemana(n, agora)).map((n) => n.id));
  if (filtro === "atencao") return new Set(neuronios.filter(precisaDeVoce).map((n) => n.id));
  return null;
}
