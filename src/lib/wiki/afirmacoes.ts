import { createHash } from "node:crypto";
import { textoComparavel } from "./citacoes";
import type { AfirmacaoWiki } from "./tipos";

/** Quantas afirmações de cada candidata o modelo vê; o servidor só aceita retirar ou substituir as que foram mostradas. */
export const LIMITE_DE_AFIRMACOES_VISIVEIS = 24;
/** Teto de afirmações por síntese; passar disso pede dividir o conceito. */
export const LIMITE_DE_AFIRMACOES = 72;

type SemId = Omit<AfirmacaoWiki, "id"> & { id?: string };

/**
 * Identidade da afirmação: o que ela diz e em que se apoia, não onde o trecho está, nem como foi escrito
 * (caixa, acento, espaços, aspas e ênfase não contam, como na comparação das citações).
 * A mesma afirmação reapresentada tem o mesmo id; trocar o texto ou a evidência cria outro.
 */
export function idDaAfirmacao(a: SemId): string {
  const apoios = a.evidencias.map((e) => JSON.stringify([e.fonteId, textoComparavel(e.citacao)])).sort();
  return `a${createHash("sha1").update(JSON.stringify([textoComparavel(a.texto), apoios])).digest("hex").slice(0, 10)}`;
}

export const comId = (a: SemId): AfirmacaoWiki => ({ ...a, id: a.id ?? idDaAfirmacao(a) });
/** Afirmações gravadas antes dos ids (ou vindas do banco sem eles) ganham o id que teriam. */
export const garantirIds = (afirmacoes: SemId[]): AfirmacaoWiki[] => afirmacoes.map(comId);

/**
 * Quais afirmações o modelo vê, em ordem: as obsoletas (a origem delas mudou, e são as que pedem correção),
 * as que a origem desta nota sustenta, as que falam do mesmo assunto do trecho e, por fim, o resto na ordem da síntese.
 */
export function afirmacoesVisiveis(afirmacoes: AfirmacaoWiki[], criterios: {
  origemId: string; obsoletas?: ReadonlySet<string>; relacionada?: (texto: string) => boolean;
}): AfirmacaoWiki[] {
  const { origemId, obsoletas, relacionada } = criterios;
  const faixa = (a: AfirmacaoWiki) => obsoletas?.has(a.id) ? 0 : a.evidencias.some((e) => e.fonteId === origemId) ? 1 : relacionada?.(a.texto) ? 2 : 3;
  // `sort` é estável: dentro de cada faixa vale a ordem da síntese.
  return afirmacoes.map((a) => ({ a, f: faixa(a) })).sort((x, y) => x.f - y.f).map(({ a }) => a).slice(0, LIMITE_DE_AFIRMACOES_VISIVEIS);
}
