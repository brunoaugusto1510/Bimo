import type { NotaParaArvore } from "../arvore-de-notas";

export type NotaLocal = { resumo: NotaParaArvore; criadoEm: number };
export type NotasLocais = ReadonlyMap<string, NotaLocal>;

export function mesclarNotasLocais(base: ReadonlyMap<string, NotaParaArvore>, locais: NotasLocais): Map<string, NotaParaArvore> {
  return new Map([...base, ...[...locais].map(([id, local]) => [id, local.resumo] as const)]);
}

/** Só uma leitura posterior à escrita pode confirmar a listagem que a substitui. */
export function podarNotasLocais(locais: NotasLocais, base: ReadonlyMap<string, NotaParaArvore>, iniciadoEm: number): NotasLocais {
  return new Map([...locais].filter(([id, local]) => iniciadoEm <= local.criadoEm || !base.has(id)));
}
