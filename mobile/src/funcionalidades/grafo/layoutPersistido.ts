import type { Posicao } from "@/compartilhado/grafo/posicionamento";

// Suba este número quando o formato mudar. É cache de conveniência, não dado
// do usuário: descartar é mais barato e mais seguro que migrar.
export const VERSAO_DO_LAYOUT = 1;

export type LayoutPersistido = {
  versao: number;
  posicoes: Record<string, Posicao>;
  zoom: number;
  deslocamentoX: number;
  deslocamentoY: number;
  alturaDaFolha: number;
};

// Casa o que veio do disco com as notas que o vault tem agora: conhecida usa a
// posição salva, nova entra pelo layout circular (ausência = sem entrada), e
// órfã de nota apagada é descartada.
export function reconciliarLayout(salvo: LayoutPersistido | null, ids: string[]): Record<string, Posicao> {
  if (salvo === null || salvo.versao !== VERSAO_DO_LAYOUT || !salvo.posicoes) return {};

  const conhecidos = new Set(ids);
  const resultado: Record<string, Posicao> = {};

  for (const [id, posicao] of Object.entries(salvo.posicoes)) {
    if (conhecidos.has(id)) resultado[id] = posicao;
  }

  return resultado;
}
