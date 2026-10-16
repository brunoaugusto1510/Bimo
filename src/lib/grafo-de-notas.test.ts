import { describe, expect, it } from "vitest";
import { dividirCaminho } from "./caminho-da-nota";
import { CONFIGURACAO_PADRAO, type ConfiguracaoDoGrafo } from "./fisica-do-grafo";
import { montarGrafoDeNotas } from "./grafo-de-notas";

/** As mesmas fixtures do grafo antigo: o id é o caminho, para comparar com o que ele devolvia. */
function montar(conteudos: Record<string, string>, configuracao: Partial<ConfiguracaoDoGrafo> = {}) {
  return montarGrafoDeNotas({
    notas: Object.entries(conteudos).map(([caminho, conteudo]) => ({
      id: caminho,
      ...dividirCaminho(caminho),
      conteudo,
    })),
    configuracao: { ...CONFIGURACAO_PADRAO, ...configuracao },
  });
}

describe("montarGrafoDeNotas", () => {
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
    const grafo = montar({ "A.md": "#Ideia solta", "B.md": "---\ntags: [ideia]\n---\n" }, { showTags: true });

    expect(grafo.nos.filter((n) => n.tipo === "tag")).toEqual([{ tipo: "tag", id: "tag:ideia", titulo: "#Ideia" }]);
    expect(grafo.arestas).toEqual([
      { de: "A.md", para: "tag:ideia" },
      { de: "B.md", para: "tag:ideia" },
    ]);
  });

  it("não cria nós de tag sem showTags", () => {
    expect(montar({ "A.md": "#ideia" }).nos.some((n) => n.tipo === "tag")).toBe(false);
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

  it("usa o id da nota (não o título) nos nós e nas arestas, e resolve título repetido pela pasta", () => {
    const grafo = montarGrafoDeNotas({
      notas: [
        { id: "10", titulo: "Origem", pasta: "Leituras", conteudo: "[[Resumo]]" },
        { id: "11", titulo: "Resumo", pasta: "Faculdade", conteudo: "" },
        { id: "12", titulo: "Resumo", pasta: "Leituras", conteudo: "" },
      ],
      configuracao: CONFIGURACAO_PADRAO,
    });

    expect(grafo.arestas).toEqual([{ de: "10", para: "12" }]);
    expect(grafo.nos.map((n) => (n.tipo === "nota" ? n.grupo : null))).toEqual(["Leituras", "Faculdade", "Leituras"]);
  });

  it("não ganha links de notas sem conteúdo", () => {
    const grafo = montarGrafoDeNotas({
      notas: [
        { id: "1", titulo: "A", pasta: null, conteudo: "" },
        { id: "2", titulo: "B", pasta: null, conteudo: "[[A]]" },
      ],
      configuracao: CONFIGURACAO_PADRAO,
    });

    expect(grafo.arestas).toEqual([{ de: "2", para: "1" }]);
  });
});
