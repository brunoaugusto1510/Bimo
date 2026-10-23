import type { EstruturaWiki } from "./tipos";

/** Linhas anteriores à 0010 tinham perguntas só no markdown. A primeira atualização não pode apagá-las. */
export function estruturaCompativel(estrutura: EstruturaWiki, conteudo: string): EstruturaWiki {
  if (estrutura.lacunas.length) return estrutura;
  const secao = conteudo.match(/^## Questões em aberto\s*\r?\n([\s\S]*?)(?=^## |$(?![\s\S]))/m)?.[1] ?? "";
  const lacunas = [...secao.matchAll(/^\s*- (.+)$/gm)].map((m) => m[1].trim().replace(/\\([\\`*_{}[\]<>()!#|])/g, "$1")).filter(Boolean).slice(0, 10);
  return lacunas.length ? { ...estrutura, lacunas } : estrutura;
}
