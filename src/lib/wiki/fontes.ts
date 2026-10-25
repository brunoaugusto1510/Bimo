import { createHash } from "node:crypto";
import { mesmoConteudo } from "./citacoes";
import type { AfirmacaoWiki, FonteCompactaWiki, FontePersistidaWiki, FonteWiki } from "./tipos";

export const hashDoConteudo = (texto: string) => createHash("sha256").update(texto, "utf8").digest("hex");
const semDestinos = (texto: string) => texto.replace(/\[\[[^\]]*\]\]/g, "[[]]");

/** Legado continua legível durante a atualização; reescrever só destinos não muda os fatos. */
export function fonteConfere(conteudo: string, fonte: FontePersistidaWiki) {
  return "conteudo" in fonte ? mesmoConteudo(conteudo, fonte.conteudo)
    : hashDoConteudo(conteudo) === fonte.hash || hashDoConteudo(semDestinos(conteudo)) === fonte.hashSemOrganizacao;
}

/** Nunca replica a origem inteira: só o que de fato sustenta as afirmações desta publicação. */
export function compactarFontes(fontes: FonteWiki[], afirmacoes: AfirmacaoWiki[]): FonteCompactaWiki[] {
  return fontes.map(({ id, titulo, pasta, revisao, conteudo }) => {
    const trechos = new Map<string, FonteCompactaWiki["trechos"][number]>();
    for (const a of afirmacoes) for (const e of a.evidencias) if (e.fonteId === id) {
      const trecho = { inicio: e.inicio, fim: e.fim, texto: e.citacao };
      trechos.set(JSON.stringify(trecho), trecho);
    }
    return { id, titulo, pasta, revisao, hash: hashDoConteudo(conteudo), hashSemOrganizacao: hashDoConteudo(semDestinos(conteudo)), trechos: [...trechos.values()] };
  });
}
