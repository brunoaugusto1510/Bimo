import { normalizarTexto } from "./caminho-da-nota";
import { ErroDeFerramenta } from "./erro-de-ferramenta";
import type { RepositorioDeNotas, ResultadoDeBusca } from "./repositorio-de-notas/tipos";
import { comTermosDe } from "./wiki/recuperacao";

const MAX_CONSULTAS = 4;

export function validarConsultasAdicionais(valor: unknown): string[] {
  if (valor === undefined || valor === null) return [];
  if (!Array.isArray(valor) || valor.length > MAX_CONSULTAS
    || valor.some((v) => typeof v !== "string" || !v.trim() || v.length > 160)) {
    throw new ErroDeFerramenta("consultas deve conter até quatro buscas, cada uma com 1 a 160 caracteres.");
  }
  return valor.map((v: string) => v.trim());
}

const chaveDaConsulta = (consulta: string) => normalizarTexto(consulta).replace(/\s+/g, " ").trim();

/** Só uma busca simples vazia pode ser ampliada automaticamente; aspas e operadores preservam a intenção. */
function termosParaAmpliar(consulta: string) {
  if (!/^[\p{L}\p{N}\s]+$/u.test(consulta) || /\b(?:OR|AND|NOT)\b/i.test(consulta)) return [];
  const termos = consulta.split(/\s+/).filter((termo) => comTermosDe(termo));
  const vistos = new Set<string>();
  const unicos = termos.filter((termo) => {
    const chave = chaveDaConsulta(termo);
    if (vistos.has(chave)) return false;
    vistos.add(chave); return true;
  });
  return unicos.length > 1 ? unicos.slice(0, MAX_CONSULTAS) : [];
}

/** Mantém o ranking da consulta original e intercala os demais assuntos para um deles não ocupar todo o limite. */
export async function buscarNotasDoAgente(repo: RepositorioDeNotas, consulta: string, limite: number, consultas: string[]) {
  const originais = await repo.buscarPorConteudo(consulta, limite);
  const vistas = new Set([chaveDaConsulta(consulta)]);
  const adicionais = (consultas.length ? consultas : originais.length ? [] : termosParaAmpliar(consulta))
    .filter((q) => {
      const chave = chaveDaConsulta(q);
      if (vistas.has(chave)) return false;
      vistas.add(chave); return true;
    });
  const listas = await Promise.all(adicionais.map((q) => repo.buscarPorConteudo(q, limite)));
  const unicos = new Map<string, ResultadoDeBusca>(originais.map((n) => [n.id, n]));
  for (let posicao = 0; posicao < limite && unicos.size < limite; posicao++) {
    for (const lista of listas) {
      const nota = lista[posicao];
      if (nota && !unicos.has(nota.id)) unicos.set(nota.id, nota);
      if (unicos.size >= limite) break;
    }
  }
  return { resultados: [...unicos.values()].slice(0, limite), ampliada: adicionais.length > 0,
    buscas: [{ consulta, encontradas: originais.length }, ...adicionais.map((q, i) => ({ consulta: q, encontradas: listas[i].length }))] };
}
