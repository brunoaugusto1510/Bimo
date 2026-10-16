/**
 * O trecho que aparece ao passar o mouse sobre uma `[[ligação]]`: o começo da
 * nota, sem frontmatter nem sintaxe de Markdown, numa linha só. Pura.
 */

import { extrairLigacoes } from "./ligacoes";
import { separarFrontmatter } from "./markdown-da-nota";

export const TAMANHO_DA_PREVIA = 400;

/** Troca cada `[[ligação]]` pelo que a pessoa lê: o apelido, ou o nome da nota. */
function simplificarLigacoes(texto: string): string {
  let resultado = "";
  let cursor = 0;
  for (const ligacao of extrairLigacoes(texto)) {
    const inicio = ligacao.embutida ? ligacao.inicio - 1 : ligacao.inicio;
    resultado += texto.slice(cursor, inicio) + (ligacao.apelido ?? ligacao.alvo);
    cursor = ligacao.fim;
  }
  return resultado + texto.slice(cursor);
}

/** Tira os blocos cercados (``` ou ~~~) inteiros; uma cerca que não fecha vai até o fim. */
function semBlocosDeCodigo(texto: string): string {
  let cerca: string | null = null;

  return texto
    .split("\n")
    .filter((linha) => {
      const marca = /^ {0,3}(`{3,}|~{3,})/.exec(linha)?.[1];
      if (cerca === null) {
        if (marca) cerca = marca[0];
        return !marca;
      }
      if (marca && marca[0] === cerca && /^ {0,3}(`{3,}|~{3,})[ \t\r]*$/.test(linha)) cerca = null;
      return false;
    })
    .join("\n");
}

export function criarPrevia(conteudo: string, limite = TAMANHO_DA_PREVIA): string {
  const { corpo } = separarFrontmatter(conteudo);

  const texto = simplificarLigacoes(semBlocosDeCodigo(corpo))
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/`([^`\n]*)`/g, "$1")
    .replace(/^\s{0,3}(?:#{1,6}|>|[-*+]|\d+[.)])\s+/gm, "")
    .replace(/\*+|~~/g, "")
    // Sublinhado de ênfase só nas pontas de palavra: `meu_arquivo` não é ênfase.
    .replace(/(?<![\p{L}\p{N}])_+|_+(?![\p{L}\p{N}])/gu, "")
    .replace(/\s+/g, " ")
    .trim();

  if (texto.length <= limite) return texto;

  const corte = texto.lastIndexOf(" ", limite);
  return `${texto.slice(0, corte > limite / 2 ? corte : limite).trimEnd()}…`;
}
