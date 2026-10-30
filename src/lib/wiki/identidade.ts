import { normalizarTexto } from "../caminho-da-nota";

/** O sufixo de desambiguação da publicação não cria um novo assunto. Outros qualificadores continuam significativos. */
export function identidadeDoTema(texto: string): string {
  return normalizarTexto(texto.normalize("NFKC")).replace(/(?:\s*\(sintese\))+\s*$/u, "").replace(/\s+/gu, " ").trim();
}
