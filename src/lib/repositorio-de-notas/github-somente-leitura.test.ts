import { beforeEach, describe, expect, it, vi } from "vitest";
import { CONFIGURACAO_PADRAO } from "../fisica-do-grafo";

vi.mock("../vault-real", () => ({
  obterNotasPlanas: vi.fn(),
  lerConteudoDaNota: vi.fn(),
  buscarNotas: vi.fn(),
  marcaDoCache: vi.fn(),
  invalidarCache: vi.fn(),
}));
vi.mock("../github", () => ({
  getGitHubConfig: vi.fn(() => ({ repo: "u/v", branch: "main", token: "t", subpath: "" })),
  readFile: vi.fn(),
}));

import { readFile } from "../github";
import { buscarNotas, invalidarCache, lerConteudoDaNota, marcaDoCache, obterNotasPlanas } from "../vault-real";
import {
  codificarIdDoGithub,
  criarRepositorioDoGithub,
  decodificarIdDoGithub,
} from "./github-somente-leitura";

const PLANAS = [
  { caminho: "Estudos/Redes/TCP.md", sha: "s1", tamanho: 10 },
  { caminho: "Bem-vindo.md", sha: "s2", tamanho: 10 },
];

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(obterNotasPlanas).mockResolvedValue({ notas: PLANAS });
  vi.mocked(lerConteudoDaNota).mockImplementation(async (caminho) => `conteúdo de ${caminho}`);
});

describe("ids do GitHub", () => {
  it("o id é opaco: sem barra nem dois-pontos, e volta ao caminho", () => {
    const id = codificarIdDoGithub("Estudos/Redes/TCP.md");

    expect(id).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodificarIdDoGithub(id)).toBe("Estudos/Redes/TCP.md");
  });

  it("aguenta acentos e emojis", () => {
    const caminho = "Diário/Café ☕.md";

    expect(decodificarIdDoGithub(codificarIdDoGithub(caminho))).toBe(caminho);
  });

  it("recusa o que não é um id nosso", () => {
    expect(decodificarIdDoGithub("não é id!")).toBeNull();
    expect(decodificarIdDoGithub("")).toBeNull();
  });
});

describe("repositório do GitHub (somente leitura)", () => {
  it("não aceita escrita e não sabe datas", () => {
    expect(criarRepositorioDoGithub().capacidades).toEqual({ escrita: false, datas: false });
  });

  it("lista os resumos com pasta e título do caminho, sem datas nem tags", async () => {
    const resumos = await criarRepositorioDoGithub().listarResumos();

    expect(resumos).toEqual([
      {
        id: codificarIdDoGithub("Estudos/Redes/TCP.md"),
        titulo: "TCP",
        pasta: "Estudos/Redes",
        tags: [],
        criadoEm: null,
        atualizadoEm: null,
        revisao: 0,
      },
      {
        id: codificarIdDoGithub("Bem-vindo.md"),
        titulo: "Bem-vindo",
        pasta: null,
        tags: [],
        criadoEm: null,
        atualizadoEm: null,
        revisao: 0,
      },
    ]);
  });

  it("uma nota que falha ao baixar não derruba a lista: vem vazia, com aviso, e o cache é descartado para tentar de novo", async () => {
    vi.mocked(lerConteudoDaNota).mockImplementation(async (caminho) => {
      if (caminho === "Bem-vindo.md") throw new Error("falhou");
      return "texto do TCP";
    });
    const repo = criarRepositorioDoGithub();

    const notas = await repo.listarComConteudo();

    expect(notas.map((n) => n.conteudo)).toEqual(["texto do TCP", ""]);
    expect(await repo.obterAviso()).toMatch(/1 nota.*não pôde ser lida/);
    // Sem isso a montagem degradada ficaria guardada até o cache vencer.
    expect(invalidarCache).toHaveBeenCalled();
  });

  it("depois de uma leitura completa, o aviso de falha some", async () => {
    vi.mocked(lerConteudoDaNota).mockRejectedValueOnce(new Error("falhou"));
    const repo = criarRepositorioDoGithub();
    await repo.listarComConteudo();

    await repo.listarComConteudo();

    expect(await repo.obterAviso()).toBeUndefined();
  });

  it("só baixa o conteúdo das primeiras 800 notas, como o grafo sempre fez", async () => {
    const muitas = Array.from({ length: 805 }, (_, i) => ({ caminho: `N${i}.md`, sha: `s${i}`, tamanho: 1 }));
    vi.mocked(obterNotasPlanas).mockResolvedValue({ notas: muitas });
    const repo = criarRepositorioDoGithub();

    const notas = await repo.listarComConteudo();

    expect(notas).toHaveLength(805);
    expect(lerConteudoDaNota).toHaveBeenCalledTimes(800);
    expect(notas[804].conteudo).toBe("");
    expect(await repo.obterAviso()).toMatch(/805 notas.*800/);
  });

  it("obterNota lê o conteúdo pelo id; id desconhecido ou inválido dá null", async () => {
    const repo = criarRepositorioDoGithub();

    const nota = await repo.obterNota(codificarIdDoGithub("Bem-vindo.md"));

    expect(nota).toMatchObject({ titulo: "Bem-vindo", pasta: null, conteudo: "conteúdo de Bem-vindo.md" });
    expect(await repo.obterNota(codificarIdDoGithub("Nao/Existe.md"))).toBeNull();
    expect(await repo.obterNota("não é id!")).toBeNull();
  });

  it("repassa o aviso de listagem incompleta do GitHub", async () => {
    vi.mocked(obterNotasPlanas).mockResolvedValue({ notas: PLANAS, aviso: "lista incompleta" });

    expect(await criarRepositorioDoGithub().obterAviso()).toBe("lista incompleta");
  });

  it("sem problema na listagem, não há aviso", async () => {
    expect(await criarRepositorioDoGithub().obterAviso()).toBeUndefined();
  });

  it("a marca de versão é a do cache do GitHub", async () => {
    vi.mocked(marcaDoCache).mockResolvedValue("123");

    expect(await criarRepositorioDoGithub().marcaDeVersao()).toBe("123");
  });

  it("converte os resultados da busca para ids", async () => {
    vi.mocked(buscarNotas).mockResolvedValue({
      resultados: [{ caminho: "Estudos/Redes/TCP.md", sha: "s1", tamanho: 10, titulo: "TCP", trecho: "…handshake…", score: 3 }],
    });

    const resultados = await criarRepositorioDoGithub().buscarPorConteudo("handshake", 5);

    expect(buscarNotas).toHaveBeenCalledWith("handshake", 5);
    expect(resultados).toEqual([
      { id: codificarIdDoGithub("Estudos/Redes/TCP.md"), titulo: "TCP", pasta: "Estudos/Redes", trecho: "…handshake…" },
    ]);
  });

  it("recusa toda escrita", async () => {
    const repo = criarRepositorioDoGithub();
    const autor = { criadoPor: "usuario" } as const;

    expect(await repo.criarNota({ titulo: "X" }, autor)).toEqual({ tipo: "somente-leitura" });
    expect(await repo.atualizarNota("id", { conteudo: "x" }, { revisaoBase: 0, autor })).toEqual({
      tipo: "somente-leitura",
    });
    expect(await repo.renomearNota("id", "Y", { revisaoBase: 0, autor })).toEqual({ tipo: "somente-leitura" });
  });

  describe("configuração do grafo", () => {
    it("usa os padrões quando o repositório não tem graph.json", async () => {
      vi.mocked(readFile).mockResolvedValue(null);

      expect(await criarRepositorioDoGithub().obterConfiguracaoDoGrafo()).toEqual(CONFIGURACAO_PADRAO);
    });

    it("lê o graph.json do Obsidian", async () => {
      vi.mocked(readFile).mockResolvedValue(JSON.stringify({ showTags: true, linkDistance: 123 }));

      const configuracao = await criarRepositorioDoGithub().obterConfiguracaoDoGrafo();

      expect(configuracao).toMatchObject({ showTags: true, linkDistance: 123 });
    });

    it("cai nos padrões quando o arquivo está quebrado ou a leitura falha", async () => {
      vi.mocked(readFile).mockResolvedValueOnce("{ quebrado");
      expect(await criarRepositorioDoGithub().obterConfiguracaoDoGrafo()).toEqual(CONFIGURACAO_PADRAO);

      vi.mocked(readFile).mockRejectedValueOnce(new Error("rede"));
      expect(await criarRepositorioDoGithub().obterConfiguracaoDoGrafo()).toEqual(CONFIGURACAO_PADRAO);
    });
  });
});
