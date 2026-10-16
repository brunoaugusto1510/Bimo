import { describe, expect, it } from "vitest";
import {
  contarPalavras,
  extrairTags,
  extrairTitulos,
  mascararCodigo,
  separarFrontmatter,
  trechoAoRedor,
} from "./markdown-da-nota";

describe("separarFrontmatter", () => {
  it("separa o bloco YAML do corpo", () => {
    const resultado = separarFrontmatter("---\ntags: [a]\n---\nTexto");
    expect(resultado.frontmatter).toBe("tags: [a]");
    expect(resultado.corpo).toBe("Texto");
    expect(resultado.inicioDoCorpo).toBe("---\ntags: [a]\n---\n".length);
  });

  it("sem frontmatter, o corpo é o texto inteiro", () => {
    expect(separarFrontmatter("Só texto")).toEqual({ frontmatter: null, corpo: "Só texto", inicioDoCorpo: 0 });
  });

  it("um frontmatter vazio não engole o corpo até a próxima linha horizontal", () => {
    const resultado = separarFrontmatter("---\n---\ncorpo\n\n---\n\nmais");
    expect(resultado.frontmatter).toBeNull();
    expect(resultado.corpo).toBe("corpo\n\n---\n\nmais");
  });

  it("entende quebras de linha do Windows", () => {
    expect(separarFrontmatter("---\r\ntags: [a]\r\n---\r\nTexto").corpo).toBe("Texto");
  });
});

describe("mascararCodigo", () => {
  it("troca blocos e trechos de código por espaços, mantendo o tamanho e as quebras de linha", () => {
    const texto = "antes `x` meio\n```\n#codigo\n```\ndepois";
    const mascarado = mascararCodigo(texto);

    expect(mascarado).toHaveLength(texto.length);
    expect(mascarado.split("\n")).toHaveLength(texto.split("\n").length);
    expect(mascarado).not.toContain("codigo");
    expect(mascarado).not.toContain("`");
    expect(mascarado).toContain("antes");
    expect(mascarado).toContain("depois");
  });
});

describe("mascararCodigo — cercas", () => {
  it("uma cerca maior contém as menores: o que está dentro continua sendo código", () => {
    const texto = "````md\n```\ncode\n```\n[[X]]\n````\n[[Y]]";
    const mascarado = mascararCodigo(texto);

    expect(mascarado).not.toContain("[[X]]");
    expect(mascarado).not.toContain("`");
    expect(mascarado).toContain("[[Y]]");
    expect(mascarado).toHaveLength(texto.length);
  });

  it("uma cerca aberta e nunca fechada vai até o fim do texto, como no CommonMark", () => {
    const mascarado = mascararCodigo("a [[A]]\n```\n[[X]]\nmais [[Z]]");

    expect(mascarado).toContain("[[A]]");
    expect(mascarado).not.toContain("[[X]]");
    expect(mascarado).not.toContain("[[Z]]");
  });

  it("a cerca de fechamento precisa ser do mesmo tipo e estar sozinha na linha", () => {
    const mascarado = mascararCodigo("~~~\n```\n[[X]]\n~~~ fim\n[[Y]]\n~~~\n[[Z]]");

    expect(mascarado).not.toContain("[[X]]");
    expect(mascarado).not.toContain("[[Y]]");
    expect(mascarado).toContain("[[Z]]");
  });

  it("aceita até três espaços antes da cerca, e não mais", () => {
    expect(mascararCodigo("   ```\n[[X]]\n   ```\n[[Y]]")).not.toContain("[[X]]");
    expect(mascararCodigo("    ```\n[[X]]")).toContain("[[X]]");
  });

  it("três crases no meio de uma frase não abrem uma cerca", () => {
    expect(mascararCodigo("use ``` no meio\n[[X]]")).toContain("[[X]]");
  });
});

describe("extrairTags", () => {
  it("acha tags no texto, inclusive aninhadas", () => {
    expect(extrairTags("Ideia #projeto e #estudo/redes no meio.")).toEqual(["projeto", "estudo/redes"]);
  });

  it("ignora títulos, números puros, âncoras de URL e código", () => {
    const conteudo = ["# Título", "Issue #123 e https://site.com/#ancora", "`#emlinha`", "```", "#embloco", "```", "#valida"].join(
      "\n",
    );

    expect(extrairTags(conteudo)).toEqual(["valida"]);
  });

  it("lê tags do frontmatter em lista inline e em lista de blocos", () => {
    expect(extrairTags('---\ntags: [projeto, "#estudo"]\n---\nTexto')).toEqual(["projeto", "estudo"]);
    expect(extrairTags("---\ntitulo: X\ntags:\n  - projeto\n  - estudo\n---\nTexto")).toEqual(["projeto", "estudo"]);
  });

  it("não confunde um frontmatter vazio com o texto até a próxima linha horizontal", () => {
    expect(extrairTags("---\n---\ncorpo #um\n\ntexto\n\n---\n\nmais #dois")).toEqual(["um", "dois"]);
  });

  it("lê tags do frontmatter separadas por vírgula ou espaço", () => {
    expect(extrairTags("---\ntags: projeto, estudo outra\n---\n")).toEqual(["projeto", "estudo", "outra"]);
  });

  it("junta grafias que só diferem em maiúsculas", () => {
    expect(extrairTags("#Ideia e #ideia")).toEqual(["Ideia"]);
  });
});

describe("extrairTitulos", () => {
  it("lista os títulos com nível, texto e linha (começando em 1)", () => {
    const conteudo = "# Um\ntexto\n## Dois ##\n### Três";
    expect(extrairTitulos(conteudo)).toEqual([
      { nivel: 1, texto: "Um", linha: 1 },
      { nivel: 2, texto: "Dois", linha: 3 },
      { nivel: 3, texto: "Três", linha: 4 },
    ]);
  });

  it("ignora o que está em bloco de código e no frontmatter", () => {
    const conteudo = "---\n# comentário yaml\n---\n```\n# no código\n```\n# Real";
    expect(extrairTitulos(conteudo)).toEqual([{ nivel: 1, texto: "Real", linha: 7 }]);
  });

  it("exige espaço depois do # (senão é tag)", () => {
    expect(extrairTitulos("#tag\n# Título")).toEqual([{ nivel: 1, texto: "Título", linha: 2 }]);
  });

  it("mantém o código em linha dentro do texto do título", () => {
    expect(extrairTitulos("## Usando `fetch`")).toEqual([{ nivel: 2, texto: "Usando `fetch`", linha: 1 }]);
  });

  it("lê um título cercado de espaços e um título só de código em linha", () => {
    expect(extrairTitulos("#   Com espaços   ")).toEqual([{ nivel: 1, texto: "Com espaços", linha: 1 }]);
    expect(extrairTitulos("## `codigo`")).toEqual([{ nivel: 2, texto: "`codigo`", linha: 1 }]);
    expect(extrairTitulos("# C#")).toEqual([{ nivel: 1, texto: "C#", linha: 1 }]);
  });

  it("não trava com uma linha de título cheia de espaços", () => {
    const linha = `# a${" ".repeat(60_000)}y`;

    const inicio = performance.now();
    const titulos = extrairTitulos(linha);

    expect(performance.now() - inicio).toBeLessThan(500);
    expect(titulos).toHaveLength(1);
  });

  it("limita a seis níveis", () => {
    expect(extrairTitulos("####### sete")).toEqual([]);
  });
});

describe("contarPalavras", () => {
  it("conta palavras do corpo, sem o frontmatter nem símbolos soltos", () => {
    expect(contarPalavras("---\ntags: [a, b]\n---\nUm texto — com 5 palavras.")).toBe(5);
  });

  it("devolve 0 para texto vazio", () => {
    expect(contarPalavras("")).toBe(0);
    expect(contarPalavras("  \n ")).toBe(0);
  });
});

describe("trechoAoRedor", () => {
  it("pega o texto em volta da posição, em uma linha só", () => {
    const texto = "início do texto\ncom link aqui [[Alvo]] e mais coisas\nfim";
    const trecho = trechoAoRedor(texto, texto.indexOf("[[Alvo]]"), 20);

    expect(trecho).toContain("[[Alvo]]");
    expect(trecho).not.toContain("\n");
    expect(trecho.startsWith("…")).toBe(true);
    expect(trecho.endsWith("…")).toBe(true);
  });

  it("não põe reticências quando o texto cabe inteiro", () => {
    expect(trechoAoRedor("curto [[A]] texto", 6, 80)).toBe("curto [[A]] texto");
  });
});
