import { describe, expect, it } from "vitest";
import {
  criarResolvedor,
  extrairLigacoes,
  formatarLigacao,
  reescreverLigacoes,
  trocarTituloNoAlvo,
  type NotaParaResolver,
} from "./ligacoes";

describe("extrairLigacoes", () => {
  it("lê o alvo e as variações: seção, bloco e apelido", () => {
    const ligacoes = extrairLigacoes("[[A]] [[B#Seção]] [[C^bloco]] [[D|apelido]] [[E#s|ap]]");

    expect(ligacoes.map(({ alvo, secao, bloco, apelido }) => ({ alvo, secao, bloco, apelido }))).toEqual([
      { alvo: "A", secao: null, bloco: null, apelido: null },
      { alvo: "B", secao: "Seção", bloco: null, apelido: null },
      { alvo: "C", secao: null, bloco: "bloco", apelido: null },
      { alvo: "D", secao: null, bloco: null, apelido: "apelido" },
      { alvo: "E", secao: "s", bloco: null, apelido: "ap" },
    ]);
  });

  it("guarda a posição do `[[...]]` no texto", () => {
    const texto = "ver [[Alvo]] aqui";
    const [ligacao] = extrairLigacoes(texto);

    expect(texto.slice(ligacao.inicio, ligacao.fim)).toBe("[[Alvo]]");
  });

  it("aceita alvo com pasta e tira a extensão .md", () => {
    const [a, b] = extrairLigacoes("[[Faculdade/Redes/TCP]] [[Outra.md]]");

    expect(a.alvo).toBe("Faculdade/Redes/TCP");
    expect(b.alvo).toBe("Outra");
  });

  it("ignora ligações dentro de código, em bloco ou em linha", () => {
    const texto = "`[[emlinha]]`\n```\n[[embloco]]\n```\n[[valida]]";

    expect(extrairLigacoes(texto).map((l) => l.alvo)).toEqual(["valida"]);
  });

  it("uma ligação escapada com barra invertida é texto, não ligação", () => {
    expect(extrairLigacoes("\\[[A]] e [[B]]").map((l) => l.alvo)).toEqual(["B"]);
  });

  it("marca anexos embutidos e arquivos que não são notas", () => {
    const [imagem, pdf, nota] = extrairLigacoes("![[foto.png]] [[relatorio.PDF]] ![[Outra nota]]");

    expect(imagem).toMatchObject({ anexo: true, embutida: true });
    expect(pdf).toMatchObject({ anexo: true, embutida: false });
    expect(nota).toMatchObject({ anexo: false, embutida: true });
  });

  it("não confunde 'Versão 1.5' com um anexo", () => {
    expect(extrairLigacoes("[[Versão 1.5]]")[0].anexo).toBe(false);
  });

  it("ignora ligação vazia, só de seção e sem fechamento", () => {
    expect(extrairLigacoes("[[]] [[#Seção]] [[sem fim\n[[A]]")).toHaveLength(1);
  });

  it("entende a barra escapada de dentro de tabelas", () => {
    const [ligacao] = extrairLigacoes("| [[A\\|apelido]] |");

    expect(ligacao).toMatchObject({ alvo: "A", apelido: "apelido" });
  });
});

describe("formatarLigacao", () => {
  it("monta de volta com seção, bloco e apelido", () => {
    expect(formatarLigacao({ alvo: "A", secao: null, bloco: null, apelido: null })).toBe("[[A]]");
    expect(formatarLigacao({ alvo: "A", secao: "S", bloco: "b", apelido: "ap" })).toBe("[[A#S^b|ap]]");
  });
});

describe("trocarTituloNoAlvo", () => {
  it("troca só o título e mantém o caminho de pasta que a ligação já tinha", () => {
    expect(trocarTituloNoAlvo("Pasta/Sub/Antigo", "Novo")).toBe("Pasta/Sub/Novo");
    expect(trocarTituloNoAlvo("Antigo", "Novo")).toBe("Novo");
  });
});

describe("reescreverLigacoes", () => {
  it("troca o alvo e preserva seção, bloco, apelido e a marca de embutida", () => {
    const texto = "[[Antigo]] [[Antigo#S|ap]] ![[Antigo]] [[Outro]]";
    const novo = reescreverLigacoes(texto, (l) => (l.alvo === "Antigo" ? "Novo" : null));

    expect(novo).toBe("[[Novo]] [[Novo#S|ap]] ![[Novo]] [[Outro]]");
  });

  it("não mexe no que está dentro de código", () => {
    const texto = "`[[Antigo]]` e [[Antigo]]";

    expect(reescreverLigacoes(texto, () => "Novo")).toBe("`[[Antigo]]` e [[Novo]]");
  });

  it("numa tabela, mantém a barra escapada que separa o apelido, senão a coluna se parte", () => {
    const tabela = "| [[Foo\\|apelido]] | [[Foo#Sec\\|ap]] | x |";

    expect(reescreverLigacoes(tabela, () => "Bar")).toBe("| [[Bar\\|apelido]] | [[Bar#Sec\\|ap]] | x |");
  });

  it("devolve o mesmo texto quando nada muda", () => {
    const texto = "texto [[A]] sem mudança";

    expect(reescreverLigacoes(texto, () => null)).toBe(texto);
  });
});

function nota(id: string, titulo: string, pasta: string | null = null): NotaParaResolver {
  return { id, titulo, pasta };
}

describe("criarResolvedor", () => {
  const notas = [
    nota("1", "Ler é uma conversa", "Leituras"),
    nota("2", "Café: variáveis"),
    nota("3", "TCP", "Faculdade/Redes"),
  ];
  const resolver = criarResolvedor(notas);

  it("resolve pelo título, sem acento e sem diferenciar maiúsculas", () => {
    expect(resolver("ler e uma conversa", null)).toEqual({ tipo: "resolvida", nota: notas[0] });
    expect(resolver("CAFÉ: VARIAVEIS", null)).toEqual({ tipo: "resolvida", nota: notas[1] });
  });

  it("resolve por 'Pasta/Título' e pelo final do caminho", () => {
    expect(resolver("Faculdade/Redes/TCP", null)).toEqual({ tipo: "resolvida", nota: notas[2] });
    expect(resolver("Redes/TCP", null)).toEqual({ tipo: "resolvida", nota: notas[2] });
  });

  it("devolve não resolvida quando nada casa", () => {
    expect(resolver("Fantasma", null)).toEqual({ tipo: "nao-resolvida" });
    expect(resolver("", null)).toEqual({ tipo: "nao-resolvida" });
  });

  describe("título repetido", () => {
    const repetidas = [
      nota("10", "Resumo", "Faculdade/Redes"),
      nota("11", "Resumo", "Faculdade"),
      nota("12", "Resumo", "Leituras"),
      nota("13", "Resumo", "Leituras"),
    ];
    const resolverRepetidas = criarResolvedor(repetidas);

    it("prefere a nota da mesma pasta da origem", () => {
      const resultado = resolverRepetidas("Resumo", "Faculdade/Redes");

      expect(resultado).toMatchObject({ tipo: "ambigua", nota: repetidas[0] });
    });

    it("sem nota na pasta da origem, prefere a menos funda", () => {
      const resultado = resolverRepetidas("Resumo", "Outra");

      expect(resultado).toMatchObject({ tipo: "ambigua", nota: repetidas[1] });
    });

    it("prefere a pasta ancestral mais próxima da origem a uma pasta rasa sem parentesco", () => {
      const notasDeCaminho = [nota("1", "X", "A/B"), nota("2", "X", "C")];

      const resultado = criarResolvedor(notasDeCaminho)("X", "A/B/Sub");

      expect(resultado).toMatchObject({ tipo: "ambigua", nota: { id: "1" } });
    });

    it("a ordem dos ids é total, mesmo com números e textos misturados", () => {
      const ids = ["10", "9a", "9", "1a"];
      const escolhas = [ids, [...ids].reverse(), [...ids].sort()].map((ordem) => {
        const resultado = criarResolvedor(ordem.map((id) => nota(id, "X", "P")))("X", null);
        return resultado.tipo === "ambigua" ? resultado.candidatas.map((n) => n.id) : [];
      });

      expect(escolhas[1]).toEqual(escolhas[0]);
      expect(escolhas[2]).toEqual(escolhas[0]);
    });

    it("em empate de profundidade, fica com o menor id", () => {
      const resultado = criarResolvedor([nota("20", "X", "A"), nota("3", "X", "B")])("X", null);

      expect(resultado).toMatchObject({ tipo: "ambigua", nota: { id: "3" } });
    });

    it("lista todas as candidatas, a escolhida primeiro", () => {
      const resultado = resolverRepetidas("Resumo", "Leituras");

      expect(resultado.tipo).toBe("ambigua");
      if (resultado.tipo === "ambigua") {
        expect(resultado.candidatas.map((n) => n.id)).toEqual(["12", "13", "11", "10"]);
      }
    });

    it("o caminho completo desfaz a ambiguidade", () => {
      expect(resolverRepetidas("Leituras/Resumo", null)).toMatchObject({ tipo: "ambigua" });
      expect(resolverRepetidas("Faculdade/Redes/Resumo", null)).toEqual({ tipo: "resolvida", nota: repetidas[0] });
    });
  });
});
