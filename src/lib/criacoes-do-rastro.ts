import type { Rastro } from "./rastro-do-agente";

const NENHUMA: ReadonlySet<string> = new Set();

/**
 * Notas que o agente criou nesta conversa. O nó de uma delas só existe depois que a lista
 * de notas atualiza — e é nessa hora que o nascimento toca, não ao fim do eco da escrita.
 */
export function idsCriadosNoRastro(rastro: Rastro | null): ReadonlySet<string> {
  if (!rastro) return NENHUMA;
  const criadas = new Set<string>();
  for (const passo of rastro.passos) {
    if (passo.tipo === "escrita" && passo.criada) criadas.add(passo.id);
  }
  return criadas.size > 0 ? criadas : NENHUMA;
}
