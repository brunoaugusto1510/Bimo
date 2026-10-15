/**
 * Busca na árvore de pastas da barra lateral: devolve só as notas que casam
 * com o texto digitado e as pastas que as contêm.
 */

import type { ItemVault } from "./types";

/** Minúsculas e sem acentos — "Álgebra" e "algebra" precisam casar. */
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/** Quantas notas há na árvore, em qualquer profundidade. */
export function contarNotas(itens: readonly ItemVault[]): number {
  return itens.reduce(
    (total, item) => total + (item.tipo === "nota" ? 1 : contarNotas(item.filhos)),
    0,
  );
}

/**
 * Cada palavra da consulta precisa aparecer no caminho da nota — que inclui os
 * nomes das pastas, então buscar "redes" traz as notas da pasta Redes. A
 * extensão `.md` fica de fora, senão buscar "md" casaria com tudo.
 */
function notaCombina(caminho: string, palavras: readonly string[]): boolean {
  const alvo = normalizar(caminho.replace(/\.md$/i, ""));
  return palavras.every((palavra) => alvo.includes(palavra));
}

function filtrarItens(itens: readonly ItemVault[], palavras: readonly string[]): ItemVault[] {
  const resultado: ItemVault[] = [];

  for (const item of itens) {
    if (item.tipo === "nota") {
      if (notaCombina(item.caminho, palavras)) resultado.push(item);
      continue;
    }
    const filhos = filtrarItens(item.filhos, palavras);
    if (filhos.length > 0) resultado.push({ ...item, filhos });
  }
  return resultado;
}

/**
 * Consulta vazia devolve a própria árvore (mesma referência — nada a refazer).
 * Não muda a árvore recebida: as pastas que sobram são cópias.
 */
export function filtrarArvore(itens: ItemVault[], consulta: string): ItemVault[] {
  const palavras = normalizar(consulta).split(/\s+/).filter(Boolean);
  if (palavras.length === 0) return itens;
  return filtrarItens(itens, palavras);
}
