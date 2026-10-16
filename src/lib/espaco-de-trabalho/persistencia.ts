/**
 * Guardar as abas no navegador (`localStorage`) para a pessoa voltar e
 * encontrá-las. Tudo que é lido de lá é tratado como desconfiável — o texto
 * pode estar velho, quebrado ou adulterado —, então é validado campo a campo e
 * o que não serve é descartado em vez de derrubar a página.
 */

import type { IdDeNota } from "../types";
import {
  ABA_DO_GRAFICO,
  LIMITE_DE_RECENTES,
  calcularProximaChave,
  type Aba,
  type EstadoDoEspaco,
  type ModoDaNota,
} from "./estado";

export const CHAVE_DO_ESPACO = "bimo_espaco";
const VERSAO = 1;
const MAXIMO_DE_ABAS = 50;
const MAXIMO_DO_HISTORICO = 100;

/** O pedaço de `Storage` que usamos — facilita trocá-lo por um falso nos testes. */
export type Armazenamento = Pick<Storage, "getItem" | "setItem">;

export function serializarEstado(estado: EstadoDoEspaco): string {
  return JSON.stringify({
    versao: VERSAO,
    abas: estado.abas,
    ativa: estado.ativa,
    recentes: estado.recentes,
  });
}

const ehTexto = (valor: unknown): valor is string => typeof valor === "string" && valor !== "";

function lerAba(bruta: unknown): Aba | null {
  if (typeof bruta !== "object" || bruta === null) return null;
  const aba = bruta as Record<string, unknown>;
  if (!ehTexto(aba.chave)) return null;

  if (aba.tipo === "vazia") return { tipo: "vazia", chave: aba.chave };
  if (aba.tipo !== "nota") return null;

  const historico = aba.historico as { pilha?: unknown; indice?: unknown } | null | undefined;
  const pilha = historico?.pilha;
  const indice = historico?.indice;
  if (!Array.isArray(pilha) || pilha.length === 0 || pilha.length > MAXIMO_DO_HISTORICO) return null;
  if (!pilha.every(ehTexto)) return null;
  if (typeof indice !== "number" || !Number.isInteger(indice) || indice < 0 || indice >= pilha.length) return null;
  if (aba.modo !== "leitura" && aba.modo !== "edicao") return null;

  return { tipo: "nota", chave: aba.chave, historico: { pilha: pilha as IdDeNota[], indice }, modo: aba.modo as ModoDaNota };
}

/** `null` quando o texto não é um estado nosso; senão, o estado com o que não serviu já descartado. */
export function lerEstado(texto: string | null): EstadoDoEspaco | null {
  if (!texto) return null;

  let bruto: unknown;
  try {
    bruto = JSON.parse(texto);
  } catch {
    return null;
  }
  if (typeof bruto !== "object" || bruto === null || Array.isArray(bruto)) return null;

  const dados = bruto as Record<string, unknown>;
  if (dados.versao !== VERSAO || !Array.isArray(dados.abas)) return null;

  const chavesVistas = new Set<string>();
  const abas: Aba[] = [];
  for (const candidata of dados.abas.slice(0, MAXIMO_DE_ABAS * 2)) {
    const aba = lerAba(candidata);
    if (!aba || chavesVistas.has(aba.chave)) continue;
    chavesVistas.add(aba.chave);
    abas.push(aba);
    if (abas.length === MAXIMO_DE_ABAS) break;
  }

  const recentes = Array.isArray(dados.recentes) ? dados.recentes.filter(ehTexto).slice(0, LIMITE_DE_RECENTES) : [];
  const ativa = ehTexto(dados.ativa) && abas.some((aba) => aba.chave === dados.ativa) ? dados.ativa : ABA_DO_GRAFICO;

  // `proximaChave` não é guardada: sai das chaves que existem.
  return { abas, ativa, proximaChave: calcularProximaChave(abas), recentes };
}

function armazenamentoDoNavegador(): Armazenamento | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function carregarEstadoSalvo(armazenamento: Armazenamento | null = armazenamentoDoNavegador()): EstadoDoEspaco | null {
  try {
    return armazenamento ? lerEstado(armazenamento.getItem(CHAVE_DO_ESPACO)) : null;
  } catch {
    return null;
  }
}

export function salvarEstado(estado: EstadoDoEspaco, armazenamento: Armazenamento | null = armazenamentoDoNavegador()): void {
  try {
    armazenamento?.setItem(CHAVE_DO_ESPACO, serializarEstado(estado));
  } catch {
    // Modo privado ou cota cheia: perder as abas ao recarregar é aceitável, quebrar a página não.
  }
}
