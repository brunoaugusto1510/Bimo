import { describe, expect, it } from "vitest";
import { CONFIGURACAO_PADRAO, type ConfiguracaoDoGrafo } from "../fisica-do-grafo";
import { extrairTags, montarGrafo, obterGrupoDoCaminho } from "../grafo";
import type { NotaPlana } from "../vault-real";

/**
 * Teste smoke da Fase 0: só prova que a config do Vitest (jsdom + alias
 * "@/*" + coverage) está funcionando, testando uma função pura que já
 * existia antes desta etapa. Os testes de verdade da Fase 1 em diante ficam
 * em arquivos próprios (ex.: `vault-real.test.ts`).
 */
describe("obterGrupoDoCaminho", () => {
  it("usa o primeiro segmento do caminho como grupo", () => {
    expect(obterGrupoDoCaminho("Estudos/Redes/TCP.md")).toBe("Estudos");
  });

  it("devolve 'Raiz' para notas sem pasta", () => {
    expect(obterGrupoDoCaminho("Bem-vindo.md")).toBe("Raiz");
  });
});

describe("extrairTags", () => {
  it("acha tags no texto, inclusive aninhadas", () => {
    expect(extrairTags("Ideia #projeto e #estudo/redes no meio.")).toEqual(["projeto", "estudo/redes"]);
  });

  it("ignora títulos, números puros, âncoras de URL e código", () => {
    const conteudo = [
      "# Título",
      "Issue #123 e https://site.com/#ancora",
      "`#emlinha`",
      "```",
      "#embloco",
      "```",
      "#valida",
    ].join("\n");

    expect(extrairTags(conteudo)).toEqual(["valida"]);
  });

  it("lê tags do frontmatter em lista inline e em lista de blocos", () => {
    expect(extrairTags("---\ntags: [projeto, \"#estudo\"]\n---\nTexto")).toEqual(["projeto", "estudo"]);
    expect(extrairTags("---\ntitulo: X\ntags:\n  - projeto\n  - estudo\n---\nTexto")).toEqual([
      "projeto",
      "estudo",
    ]);
  });

  it("não confunde um frontmatter vazio com o texto até a próxima linha horizontal", () => {
    expect(extrairTags("---\n---\ncorpo #um\n\ntexto\n\n---\n\nmais #dois")).toEqual(["um", "dois"]);
  });

  it("lê tags do frontmatter separadas por vírgula ou espaço", () => {
    expect(extrairTags("---\ntags: projeto, estudo outra\n---\n")).toEqual(["projeto", "estudo", "outra"]);
  });
});

function nota(caminho: string): NotaPlana {
  return { caminho, sha: `sha-${caminho}`, tamanho: 10 };
}

function montar(conteudos: Record<string, string>, configuracao: Partial<ConfiguracaoDoGrafo> = {}) {
  return montarGrafo({
    notas: Object.keys(conteudos).map(nota),
    conteudos: new Map(Object.entries(conteudos)),
    configuracao: { ...CONFIGURACAO_PADRAO, ...configuracao },
  });
}

describe("montarGrafo", () => {
  it("liga notas pelos [[links]], contando cada par uma vez só", () => {
    const grafo = montar({
      "A.md": "[[B]] de novo [[B|apelido]] e [[B#Seção]]",
      "Pasta/B.md": "volta para [[A]]",
    });

    expect(grafo.nos).toEqual([
      { tipo: "nota", id: "A.md", titulo: "A", grupo: "Raiz" },
      { tipo: "nota", id: "Pasta/B.md", titulo: "B", grupo: "Pasta" },
    ]);
    expect(grafo.arestas).toEqual([{ de: "A.md", para: "Pasta/B.md" }]);
  });

  it("cria um nó para cada link a uma nota que não existe, juntando grafias diferentes", () => {
    const grafo = montar({
      "A.md": "[[Fantasma]]",
      "B.md": "[[fantasma]] e [[Pasta/Outro Fantasma.md]]",
    });

    const naoResolvidas = grafo.nos.filter((n) => n.tipo === "nao-resolvida");
    expect(naoResolvidas).toEqual([
      { tipo: "nao-resolvida", id: "nao-resolvida:fantasma", titulo: "Fantasma" },
      { tipo: "nao-resolvida", id: "nao-resolvida:pasta/outro fantasma", titulo: "Outro Fantasma" },
    ]);
    expect(grafo.arestas).toContainEqual({ de: "A.md", para: "nao-resolvida:fantasma" });
    expect(grafo.arestas).toContainEqual({ de: "B.md", para: "nao-resolvida:fantasma" });
  });

  it("não transforma anexos embutidos em nós não resolvidos", () => {
    const grafo = montar({
      "A.md": "![[Pasted image 2024.png]] e [[relatorio.PDF]] e [[Quadro.canvas]]",
      "Versão 1.5.md": "",
      "B.md": "[[Versão 1.5]] e [[Rascunho 2.0]]",
    });

    expect(grafo.nos.filter((n) => n.tipo === "nao-resolvida").map((n) => n.titulo)).toEqual(["Rascunho 2.0"]);
    expect(grafo.arestas).toContainEqual({ de: "B.md", para: "Versão 1.5.md" });
  });

  it("esconde os links não resolvidos com hideUnresolved", () => {
    const grafo = montar({ "A.md": "[[Fantasma]]" }, { hideUnresolved: true });

    expect(grafo.nos.map((n) => n.id)).toEqual(["A.md"]);
    expect(grafo.arestas).toEqual([]);
  });

  it("transforma tags em nós com showTags, sem diferenciar maiúsculas", () => {
    const grafo = montar(
      { "A.md": "#Ideia solta", "B.md": "---\ntags: [ideia]\n---\n" },
      { showTags: true },
    );

    expect(grafo.nos.filter((n) => n.tipo === "tag")).toEqual([
      { tipo: "tag", id: "tag:ideia", titulo: "#Ideia" },
    ]);
    expect(grafo.arestas).toEqual([
      { de: "A.md", para: "tag:ideia" },
      { de: "B.md", para: "tag:ideia" },
    ]);
  });

  it("não cria nós de tag sem showTags", () => {
    const grafo = montar({ "A.md": "#ideia" });
    expect(grafo.nos.some((n) => n.tipo === "tag")).toBe(false);
  });

  it("tira as notas sem nenhuma ligação quando showOrphans está desligado", () => {
    const conteudos = { "A.md": "[[B]]", "B.md": "", "Sozinha.md": "nada aqui" };

    expect(montar(conteudos).nos.map((n) => n.id)).toContain("Sozinha.md");
    expect(montar(conteudos, { showOrphans: false }).nos.map((n) => n.id)).toEqual(["A.md", "B.md"]);
  });

  it("ignora auto-links", () => {
    expect(montar({ "A.md": "[[A]]" }).arestas).toEqual([]);
  });

  it("devolve a configuração usada, para o componente montar a física", () => {
    expect(montar({ "A.md": "" }, { linkDistance: 100 }).configuracao.linkDistance).toBe(100);
  });
});
