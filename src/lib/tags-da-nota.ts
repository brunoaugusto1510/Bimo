/**
 * As tags da coluna `tags` de uma nota: sem `#`, sem espaços nas pontas, sem vazias nem
 * repetidas (sem diferenciar maiúsculas; vale a grafia da primeira). É a mesma regra que
 * `validacao-de-notas.ts` aplica na borda, para o cliente mandar já o que o servidor guardaria.
 */
export function normalizarTags(tags: readonly string[]): string[] {
  const vistas = new Set<string>();
  return tags
    .map((tag) => tag.trim().replace(/^#/, "").trim())
    .filter((tag) => {
      if (tag === "" || vistas.has(tag.toLowerCase())) return false;
      vistas.add(tag.toLowerCase());
      return true;
    });
}

/** Mesmas tags, na mesma ordem, sem diferenciar maiúsculas. */
export function mesmasTags(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((tag, indice) => tag.toLowerCase() === b[indice].toLowerCase());
}
