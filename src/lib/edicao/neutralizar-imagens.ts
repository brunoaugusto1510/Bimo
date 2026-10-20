const IMAGEM_EM_LINHA = /!\[([^\]]*)\]\([^)]*\)/g;
const IMAGEM_DE_REFERENCIA = /!\[([^\]]*)\]\[([^\]]*)\]/g;
const TAG_IMG = /<img\b[^>]*>/gi;

const escapar = (texto: string) => texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Tira as imagens do texto que o Bimo propõe, deixando o texto alternativo. Uma imagem Markdown vira um pedido de
 * rede quando a nota é renderizada: com uma URL montada pelo modelo (que leu outras notas), aceitar a proposta
 * levaria esses dados para fora. Links, wikilinks (`[[Nota]]`) e imagens locais do Obsidian (`![[foto.png]]`) ficam.
 */
export function neutralizarImagens(texto: string): string {
  let atual = texto;
  for (;;) {
    const rotulos = new Set<string>();
    let proximo = atual
      .replace(IMAGEM_EM_LINHA, "$1")
      .replace(IMAGEM_DE_REFERENCIA, (_trecho, alternativo: string, referencia: string) => {
        rotulos.add((referencia || alternativo).trim().toLowerCase());
        return alternativo;
      })
      .replace(TAG_IMG, "");
    // A definição `[1]: https://…` de uma referência de imagem some junto; as de links comuns ficam.
    for (const rotulo of rotulos) proximo = proximo.replace(new RegExp(`^[ \\t]*\\[${escapar(rotulo)}\\]:[ \\t]*\\S+.*$`, "gim"), "");
    // Uma remoção pode juntar pedaços e formar outra imagem: repete até estabilizar (cada passo encurta o texto).
    if (proximo === atual) return proximo;
    atual = proximo;
  }
}
