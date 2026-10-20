import { describe, expect, it, vi } from "vitest";
import { criarRepositorioEmMemoria } from "./repositorio-de-notas/memoria";
import type { RepositorioDeNotas } from "./repositorio-de-notas/tipos";
import { buscarConteudo, obterDadosDaPagina, obterLigacoesDaNota, obterTags } from "./servico-de-notas";

const USUARIO = { criadoPor: "usuario" } as const;

describe("obterTags", () => {
  it("conta por nota, unindo coluna, frontmatter e corpo sem diferenciar caixa, e ordena por quantidade e nome", async () => {
    const repo = criarRepositorioEmMemoria([
      { titulo: "A", tags: ["Bimo", "BIMO", "zebra"], conteudo: "---\ntags: [bimo, Alpha]\n---\n#BIMO #texto #texto `#codigo`" },
      { titulo: "B", tags: ["bimo"], conteudo: "#alpha #outra" },
      { titulo: "C", conteudo: "#bimo" },
    ]);

    expect(await obterTags(repo)).toEqual([
      { nome: "Bimo", quantidade: 3 }, { nome: "Alpha", quantidade: 2 },
      { nome: "outra", quantidade: 1 }, { nome: "texto", quantidade: 1 }, { nome: "zebra", quantidade: 1 },
    ]);
  });

  it("devolve vazio quando não há tags", async () => {
    expect(await obterTags(criarRepositorioEmMemoria([{ titulo: "Sem tags" }]))).toEqual([]);
  });

  it("compartilha o cache com a página em ambas as ordens e atualiza após escrita", async () => {
    for (const tagsPrimeiro of [true, false]) {
      const repo = criarRepositorioEmMemoria([{ titulo: "A", tags: ["antiga"] }]);
      const listar = vi.spyOn(repo, "listarComConteudo");
      if (tagsPrimeiro) await obterTags(repo);
      await obterDadosDaPagina(repo);
      expect(await obterTags(repo)).toEqual([{ nome: "antiga", quantidade: 1 }]);
      await obterTags(repo);
      expect(listar).toHaveBeenCalledTimes(1);
      const [nota] = await repo.listarResumos();
      await repo.atualizarNota(nota.id, { tags: ["nova"], conteudo: "#nova #texto" }, { revisaoBase: nota.revisao, autor: USUARIO });
      expect(await obterTags(repo)).toEqual([{ nome: "nova", quantidade: 1 }, { nome: "texto", quantidade: 1 }]);
      await obterDadosDaPagina(repo);
      expect(listar).toHaveBeenCalledTimes(2);
    }
  });
});

function repositorio() {
  return criarRepositorioEmMemoria([
    { titulo: "Ler é uma conversa", pasta: "Leituras", conteudo: "Veja [[Notas atômicas]] e [[Fantasma]]. Falei de café depois." },
    { titulo: "Notas atômicas", pasta: "Método", conteudo: "Volta para [[Ler é uma conversa]]." },
    { titulo: "Café", conteudo: "Moagem e tempo." },
    { titulo: "Sozinha", conteudo: "" },
  ]);
}

async function idDe(repo: RepositorioDeNotas, titulo: string): Promise<string> {
  const nota = (await repo.listarResumos()).find((r) => r.titulo === titulo);
  if (!nota) throw new Error(`nota "${titulo}" não existe na fixture`);
  return nota.id;
}

describe("obterDadosDaPagina", () => {
  it("devolve a árvore, o grafo e as capacidades a partir de uma só leitura das notas", async () => {
    const repo = repositorio();
    const listar = vi.spyOn(repo, "listarComConteudo");

    const dados = await obterDadosDaPagina(repo);

    expect(listar).toHaveBeenCalledTimes(1);
    expect(dados.capacidades).toEqual({ escrita: true, datas: true });
    expect(dados.itens.map((i) => i.nome)).toEqual(["Leituras", "Método", "Café", "Sozinha"]);
    expect(dados.grafo.nos.filter((n) => n.tipo === "nota")).toHaveLength(4);
    // 1 -> 2 (ligação resolvida) e 1 -> "Fantasma" (não resolvida)
    expect(dados.grafo.arestas).toHaveLength(2);
    expect(dados.grafo.nos.some((n) => n.tipo === "nao-resolvida" && n.titulo === "Fantasma")).toBe(true);
  });

  it("usa o id das notas nos nós do grafo e na árvore, para o clique achar a nota", async () => {
    const repo = repositorio();
    const dados = await obterDadosDaPagina(repo);
    const id = await idDe(repo, "Café");

    expect(dados.grafo.nos).toContainEqual({ tipo: "nota", id, titulo: "Café", grupo: "Raiz" });
    expect(dados.itens).toContainEqual({ tipo: "nota", id, nome: "Café", pasta: null });
  });

  it("repassa o aviso do repositório", async () => {
    const repo = repositorio();
    vi.spyOn(repo, "obterAviso").mockResolvedValue("lista incompleta");

    expect((await obterDadosDaPagina(repo)).aviso).toBe("lista incompleta");
  });

  it("reaproveita o que montou enquanto a marca de versão não muda", async () => {
    const repo = repositorio();
    const listar = vi.spyOn(repo, "listarComConteudo");

    const primeira = await obterDadosDaPagina(repo);
    const segunda = await obterDadosDaPagina(repo);
    await obterLigacoesDaNota(repo, await idDe(repo, "Café"));

    expect(listar).toHaveBeenCalledTimes(1);
    expect(segunda.grafo).toBe(primeira.grafo);
  });

  it("refaz tudo depois de uma escrita (a marca muda sozinha)", async () => {
    const repo = repositorio();
    const antes = await obterDadosDaPagina(repo);

    await repo.criarNota({ titulo: "Nova" }, USUARIO);
    const depois = await obterDadosDaPagina(repo);

    expect(depois.grafo).not.toBe(antes.grafo);
    expect(depois.grafo.nos.filter((n) => n.tipo === "nota")).toHaveLength(5);
  });

  it("cada repositório tem o seu cache", async () => {
    const um = repositorio();
    const outro = criarRepositorioEmMemoria([{ titulo: "Só no outro" }]);

    await obterDadosDaPagina(um);
    const dados = await obterDadosDaPagina(outro);

    expect(dados.itens.map((i) => i.nome)).toEqual(["Só no outro"]);
  });
});

describe("obterLigacoesDaNota", () => {
  it("devolve as ligações de saída e de entrada e as menções sem ligação", async () => {
    const repo = repositorio();
    const id = await idDe(repo, "Ler é uma conversa");

    const detalhe = await obterLigacoesDaNota(repo, id);

    expect(detalhe?.ligacoes.saida.map((d) => (d.tipo === "nota" ? d.titulo : `?${d.titulo}`))).toEqual([
      "Notas atômicas",
      "?Fantasma",
    ]);
    expect(detalhe?.ligacoes.entrada.map((e) => e.titulo)).toEqual(["Notas atômicas"]);
    // "café" aparece no texto sem estar ligado
    expect(detalhe?.mencoesSemLigacao.map((m) => m.titulo)).toEqual(["Café"]);
  });

  it("devolve null para uma nota que não existe", async () => {
    expect(await obterLigacoesDaNota(repositorio(), "999999")).toBeNull();
  });

  it("calcula as menções com o texto salvo agora, não com o do cache", async () => {
    const repo = repositorio();
    const id = await idDe(repo, "Café");
    await obterDadosDaPagina(repo);
    const nota = await repo.obterNota(id);
    await repo.atualizarNota(id, { conteudo: "agora falo de Sozinha" }, { revisaoBase: nota!.revisao, autor: USUARIO });

    const detalhe = await obterLigacoesDaNota(repo, id);

    expect(detalhe?.mencoesSemLigacao.map((m) => m.titulo)).toEqual(["Sozinha"]);
  });
});

describe("buscarConteudo", () => {
  it("repassa a busca ao repositório", async () => {
    const repo = repositorio();

    const resultados = await buscarConteudo(repo, "moagem", 5);

    expect(resultados.map((r) => r.titulo)).toEqual(["Café"]);
  });
});
