// @vitest-environment node
import { describe, expect, it } from "vitest";
import { compactarFontes, fonteConfere, hashDoConteudo } from "./fontes";
import { conferirFontes, type FonteWiki } from "./tipos";

const fonte: FonteWiki = { id: "1", titulo: "Origem", pasta: null, revisao: 2, conteudo: "🧠 Contexto longo. A memória liga conceitos com evidência. [[Antes]]" };
describe("snapshots compactos das origens", () => {
  it("guarda hashes e apenas as citações usadas, sem duplicar trechos", () => {
    const citacao = "A memória liga conceitos com evidência.";
    const evidencia = { fonteId: "1", citacao, inicio: fonte.conteudo.indexOf(citacao), fim: fonte.conteudo.indexOf(citacao) + citacao.length };
    const [compacta] = compactarFontes([fonte], [{ id: "a", texto: "Memória", natureza: "explicita", evidencias: [evidencia, evidencia] }]);
    expect(compacta).not.toHaveProperty("conteudo");
    expect(compacta.hash).toBe(hashDoConteudo(fonte.conteudo));
    expect(compacta.trechos).toEqual([{ inicio: evidencia.inicio, fim: evidencia.fim, texto: citacao }]);
    expect(fonteConfere(fonte.conteudo, compacta)).toBe(true);
    expect(fonteConfere(fonte.conteudo.replace("evidência", "imaginação"), compacta)).toBe(false);
  });
  it("lê formato legado e tolera só a reescrita de destinos dos wikilinks", () => {
    const [compacta] = compactarFontes([fonte], []);
    for (const snapshot of [fonte, compacta]) {
      expect(fonteConfere(fonte.conteudo.replace("[[Antes]]", "[[Depois]]"), snapshot)).toBe(true);
      expect(fonteConfere(fonte.conteudo + " Outro fato.", snapshot)).toBe(false);
    }
  });
  it("revalida por hash a publicação com revisão e organização exatas", () => {
    const [compacta] = compactarFontes([fonte], []);
    const atual = { ...fonte, tags: [], criadoEm: "", atualizadoEm: "" };
    expect(() => conferirFontes([compacta], [atual], new Set())).not.toThrow();
    expect(() => conferirFontes([compacta], [{ ...atual, conteudo: fonte.conteudo + "!" }], new Set())).toThrow(/origem mudou/);
  });
});
