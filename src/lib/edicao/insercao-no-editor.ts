/** Troca `[de, ate)` por `texto`; depois a seleção vai de `cursor` até `selecaoAte` (ou fica só o cursor, sem ele). */
export type Edicao = { de: number; ate: number; texto: string; cursor: number; selecaoAte?: number };

/** Substitui a consulta e aproveita o fechamento que já estiver no campo. */
export function planejarInsercaoDeLigacao(
  texto: string,
  gatilho: { inicio: number },
  cursor: number,
  alvo: string,
): Edicao {
  const de = gatilho.inicio + 2;
  const depois = texto.slice(cursor);
  const fechamento = depois.startsWith("]]") ? 2 : depois.startsWith("]") ? 1 : 0;
  const insercao = `${alvo}]]`;
  return { de, ate: cursor + fechamento, texto: insercao, cursor: de + insercao.length };
}

/** Usa o comando nativo quando disponível para preservar o desfazer. */
export function aplicarEdicaoNoCampo(campo: HTMLTextAreaElement, edicao: Edicao): void {
  // `setRangeText` ignora o `readOnly`: sem esta guarda, uma renomeação em voo teria o texto alterado por baixo.
  if (campo.readOnly) return;
  campo.focus();
  const esperado = campo.value.slice(0, edicao.de) + edicao.texto + campo.value.slice(edicao.ate);
  campo.setSelectionRange(edicao.de, edicao.ate);
  const aplicado = typeof document.execCommand === "function"
    && document.execCommand("insertText", false, edicao.texto);
  if (aplicado && campo.value !== esperado) {
    // Alguns navegadores devolvem `true` sem aplicar (ou aplicam só parte): vale o resultado planejado.
    campo.value = esperado;
    campo.dispatchEvent(new Event("input", { bubbles: true }));
  } else if (!aplicado) {
    campo.setRangeText(edicao.texto, edicao.de, edicao.ate, "end");
    campo.dispatchEvent(new Event("input", { bubbles: true }));
  }
  campo.setSelectionRange(edicao.cursor, edicao.selecaoAte ?? edicao.cursor);
}
