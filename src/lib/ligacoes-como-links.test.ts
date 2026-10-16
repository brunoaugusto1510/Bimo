import { describe, expect, it } from "vitest";
import { PREFIXO_DE_ANEXO, PREFIXO_DE_NOTA, ligacoesComoLinks } from "./ligacoes-como-links";

describe("ligacoesComoLinks", () => {
  it("troca [[Nota]] por um link Markdown para a nota, mantendo o texto em volta", () => {
    expect(ligacoesComoLinks("veja [[Notas atômicas]] agora")).toBe(
      `veja [Notas atômicas](${PREFIXO_DE_NOTA}Notas%20at%C3%B4micas) agora`,
    );
  });

  it("mostra o apelido quando há, e a seção depois do nome quando não há", () => {
    const texto = ligacoesComoLinks("[[A|apelido]] e [[B#Seção]]");

    expect(texto).toContain(`[apelido](${PREFIXO_DE_NOTA}A)`);
    expect(texto).toContain(`[B › Seção](${PREFIXO_DE_NOTA}B#Se%C3%A7%C3%A3o)`);
  });

  it("anexos viram um marcador, nunca um link para nota", () => {
    const texto = ligacoesComoLinks("![[foto.png]] e [[doc.pdf]]");

    expect(texto).toBe(`[foto.png](${PREFIXO_DE_ANEXO}foto.png) e [doc.pdf](${PREFIXO_DE_ANEXO}doc.pdf)`);
  });

  it("uma nota embutida (![[Nota]]) é tratada como ligação comum", () => {
    expect(ligacoesComoLinks("![[Outra]]")).toBe(`[Outra](${PREFIXO_DE_NOTA}Outra)`);
  });

  it("preserva o Markdown do título: asteriscos, sublinhados e parênteses não quebram o link", () => {
    const texto = ligacoesComoLinks("[[A*B*C]] e [[_rascunho_]] e [[Nota (v2)]]");

    expect(texto).toContain("[A\\*B\\*C](");
    expect(texto).toContain("[\\_rascunho\\_](");
    // Os parênteses do alvo vão codificados, senão fechariam o destino do link antes da hora.
    expect(texto).toContain(`(${PREFIXO_DE_NOTA}Nota%20%28v2%29)`);
  });

  it("não mexe em código, em linha ou em bloco", () => {
    const texto = "`[[A]]`\n```\n[[B]]\n```\n[[C]]";

    expect(ligacoesComoLinks(texto)).toBe(`\`[[A]]\`\n\`\`\`\n[[B]]\n\`\`\`\n[C](${PREFIXO_DE_NOTA}C)`);
  });

  it("deixa uma ligação escapada com barra invertida como texto", () => {
    expect(ligacoesComoLinks("\\[[A]]")).toBe("\\[[A]]");
  });

  it("não muda o número de linhas, para os títulos manterem a posição", () => {
    const texto = "# Título\n\ntexto [[A]]\n\n## Outro [[B|b]]";

    expect(ligacoesComoLinks(texto).split("\n")).toHaveLength(texto.split("\n").length);
  });

  it("devolve o mesmo texto quando não há ligação", () => {
    const texto = "nada aqui [[sem fim e [[]]";

    expect(ligacoesComoLinks(texto)).toBe(texto);
  });

  it("funciona numa célula de tabela com a barra escapada, sem partir a coluna", () => {
    expect(ligacoesComoLinks("| [[A\\|apelido]] | x |")).toBe(`| [apelido](${PREFIXO_DE_NOTA}A) | x |`);
  });

  it("escapa no rótulo os caracteres que o Markdown leria", () => {
    expect(ligacoesComoLinks("[[A|<b>&x]]")).toContain("[\\<b\\>\\&x](");
  });
});
