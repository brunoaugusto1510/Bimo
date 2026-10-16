/**
 * A árvore de pastas e notas da barra lateral, montada a partir da lista plana
 * de notas, e a busca nela. Só conhece título e pasta — o conteúdo nunca
 * entra, então serve para qualquer fonte de notas.
 */

import { juntarCaminho, normalizarTexto } from "./caminho-da-nota";
import type { IdDeNota, ItemDeNotas } from "./types";

export type NotaParaArvore = { id: IdDeNota; titulo: string; pasta: string | null };

type NoPasta = { nome: string; caminho: string; filhos: Map<string, NoPasta>; notas: NotaParaArvore[] };

const comparar = (a: string, b: string) => a.localeCompare(b, "pt-BR");

/**
 * Agrupa as notas em pastas: cada pasta é uma entrada num Map (por nome) e
 * cada nota "desce" um nível por segmento da pasta, criando o que faltar. No
 * fim, pastas vêm antes das notas e cada grupo sai ordenado por nome, como o
 * Obsidian mostra por padrão.
 */
export function construirArvore(notas: readonly NotaParaArvore[]): ItemDeNotas[] {
  const raiz: NoPasta = { nome: "", caminho: "", filhos: new Map(), notas: [] };

  for (const nota of notas) {
    let atual = raiz;
    for (const segmento of nota.pasta ? nota.pasta.split("/") : []) {
      let filho = atual.filhos.get(segmento);
      if (!filho) {
        filho = { nome: segmento, caminho: juntarCaminho(atual.caminho || null, segmento), filhos: new Map(), notas: [] };
        atual.filhos.set(segmento, filho);
      }
      atual = filho;
    }
    atual.notas.push(nota);
  }

  function paraItens(no: NoPasta): ItemDeNotas[] {
    const pastas = [...no.filhos.values()]
      .sort((a, b) => comparar(a.nome, b.nome))
      .map((filho): ItemDeNotas => ({
        tipo: "pasta",
        nome: filho.nome,
        caminho: filho.caminho,
        filhos: paraItens(filho),
      }));

    const itensDeNota = [...no.notas]
      .sort((a, b) => comparar(a.titulo, b.titulo))
      .map((nota): ItemDeNotas => ({ tipo: "nota", id: nota.id, nome: nota.titulo, pasta: nota.pasta }));

    return [...pastas, ...itensDeNota];
  }

  return paraItens(raiz);
}

/** Quantas notas há na árvore, em qualquer profundidade. */
export function contarNotas(itens: readonly ItemDeNotas[]): number {
  return itens.reduce((total, item) => total + (item.tipo === "nota" ? 1 : contarNotas(item.filhos)), 0);
}

/**
 * Cada palavra da consulta precisa aparecer em "Pasta/Título" — que inclui os
 * nomes das pastas, então buscar "redes" traz as notas da pasta Redes.
 */
function notaCombina(item: Extract<ItemDeNotas, { tipo: "nota" }>, palavras: readonly string[]): boolean {
  const alvo = normalizarTexto(juntarCaminho(item.pasta, item.nome));
  return palavras.every((palavra) => alvo.includes(palavra));
}

function filtrarItens(itens: readonly ItemDeNotas[], palavras: readonly string[]): ItemDeNotas[] {
  const resultado: ItemDeNotas[] = [];

  for (const item of itens) {
    if (item.tipo === "nota") {
      if (notaCombina(item, palavras)) resultado.push(item);
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
export function filtrarArvore(itens: ItemDeNotas[], consulta: string): ItemDeNotas[] {
  const palavras = normalizarTexto(consulta).split(/\s+/).filter(Boolean);
  if (palavras.length === 0) return itens;
  return filtrarItens(itens, palavras);
}
