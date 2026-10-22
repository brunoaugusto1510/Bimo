import { timingSafeEqual } from "node:crypto";

/** Autosaves dentro desta janela viram um único trabalho, sobre a revisão mais recente. */
export const ESTABILIDADE_DA_WIKI_SEGUNDOS = 90;

export function automacaoWikiHabilitada() {
  return process.env.WIKI_VIVA_ATIVA === "1" && process.env.WIKI_AUTOMATICA_ATIVA === "1";
}
export function tetoDiarioWiki() {
  const valor = Number(process.env.WIKI_TETO_TOKENS_DIA ?? "200000");
  if (!Number.isSafeInteger(valor) || valor < 1 || valor > 5_000_000) throw new Error("Limite da wiki inválido.");
  return valor;
}
/** Exclusivo do executor; não concede acesso às demais rotas da aplicação. */
export function executorWikiAutorizado(request: Request) {
  const segredo = process.env.WIKI_EXECUTOR_SEGREDO?.trim();
  if (!segredo || segredo.length < 32) return false;
  const recebido = request.headers.get("authorization") ?? "";
  const esperado = `Bearer ${segredo}`;
  const a = Buffer.from(recebido); const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}
