import { normalizarTexto } from "../caminho-da-nota";

/** Abaixo disso, uma citação casa com quase qualquer texto e não prova nada — salvo quando é a entrada inteira. */
export const TAMANHO_MINIMO_DA_CITACAO = 12;

const EQUIVALENTES: Record<string, string> = {
  "“": '"', "”": '"', "„": '"', "«": '"', "»": '"',
  "‘": "'", "’": "'", " ": " ",
};
// Ênfase e colchetes de ligação que o modelo costuma omitir ao copiar um trecho.
const IGNORADOS = new Set(["*", "`", "[", "]"]);

/** Texto comparável e, para cada caractere dele, a posição de origem. */
function normalizar(texto: string) {
  let saida = ""; const posicoes: number[] = []; let espaco = false;
  for (let i = 0; i < texto.length; i++) {
    const caractere = EQUIVALENTES[texto[i]] ?? texto[i];
    if (IGNORADOS.has(caractere)) continue;
    if (/\s/.test(caractere)) {
      if (espaco || !saida) continue;
      espaco = true; saida += " "; posicoes.push(i); continue;
    }
    espaco = false; saida += caractere; posicoes.push(i);
  }
  if (saida.endsWith(" ")) { saida = saida.slice(0, -1); posicoes.pop(); }
  return { saida, posicoes };
}

/** O texto como a comparação de citações o enxerga: sem acento, caixa, espaços repetidos, aspas tipográficas e ênfase. */
export const textoComparavel = (texto: string) => normalizar(normalizarTexto(texto)).saida;

/**
 * Localiza a citação no texto tolerando espaços, aspas tipográficas e marcação de ênfase.
 * A posição devolvida aponta para o trecho original, que é o que fica guardado como evidência.
 */
export function localizarCitacao(texto: string, citacao: string): { inicio: number; fim: number } | null {
  const exata = citacao ? texto.indexOf(citacao) : -1;
  if (exata >= 0) return { inicio: exata, fim: exata + citacao.length };
  const alvo = normalizar(citacao).saida;
  if (!alvo) return null;
  const { saida, posicoes } = normalizar(texto);
  const indice = saida.indexOf(alvo);
  if (indice < 0) return null;
  return { inicio: posicoes[indice], fim: posicoes[indice + alvo.length - 1] + 1 };
}

/**
 * Mesmo texto, ignorando para onde as ligações [[...]] apontam. Renomear ou mover outra nota reescreve
 * as ligações de quem a cita, e isso não muda o que a nota diz.
 */
export function mesmoConteudo(a: string, b: string) {
  if (a === b) return true;
  const semAlvo = (texto: string) => texto.replace(/\[\[[^\]]*\]\]/g, "[[]]");
  return semAlvo(a) === semAlvo(b);
}

/** Curta demais para servir de evidência, a não ser que reproduza a entrada inteira. */
export function citacaoInsuficiente(citacao: string, entrada: string) {
  const alvo = normalizar(citacao).saida;
  return alvo.length < TAMANHO_MINIMO_DA_CITACAO && alvo !== normalizar(entrada).saida;
}
