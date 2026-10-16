import { describe, expect, it } from "vitest";
import { criarPrevia } from "./previa-de-nota";

describe("criarPrevia", () => {
  it("tira o frontmatter e a sintaxe do Markdown, deixando o texto corrido", () => {
    const conteudo = [
      "---",
      "tags: [leitura]",
      "---",
      "# Ler é uma conversa",
      "",
      "Marginália é **resposta**, não _anotação_. Veja [o site](https://x.com) e `código`.",
      "",
      "- item um",
      "> citação",
    ].join("\n");

    expect(criarPrevia(conteudo)).toBe(
      "Ler é uma conversa Marginália é resposta, não anotação. Veja o site e código. item um citação",
    );
  });

  it("troca [[ligações]] pelo apelido ou pelo nome da nota", () => {
    expect(criarPrevia("Veja [[Notas atômicas]], [[Café|o café]] e [[B#Seção]].")).toBe(
      "Veja Notas atômicas, o café e B.",
    );
  });

  it("corta no limite, numa palavra inteira, com reticências", () => {
    const longo = "palavra ".repeat(100);

    const previa = criarPrevia(longo, 50);

    expect(previa.length).toBeLessThanOrEqual(51);
    expect(previa.endsWith("…")).toBe(true);
    expect(previa).not.toMatch(/palav…$/);
  });

  it("não acrescenta reticências quando cabe inteiro", () => {
    expect(criarPrevia("curto e bom")).toBe("curto e bom");
  });

  it("devolve vazio para uma nota sem texto", () => {
    expect(criarPrevia("")).toBe("");
    expect(criarPrevia("---\ntags: [a]\n---\n")).toBe("");
  });

  it("não deixa blocos de código vazarem para a prévia", () => {
    expect(criarPrevia("antes\n```\nconst x = 1;\n```\ndepois")).toBe("antes depois");
  });
});
