import { beforeEach, describe, expect, it, vi } from "vitest";
import { declaracoesDeFerramentas, executarFerramenta } from "./ferramentas";

/**
 * Mocka a camada de dados (`vault-real.ts`) inteira: o que importa aqui é o
 * despacho de `executarFerramenta` e a normalização de argumentos, não a
 * lógica de busca em si (isso já está coberto em `vault-real.test.ts`).
 */
vi.mock("./vault-real", () => ({
  buscarNotas: vi.fn(),
  lerNota: vi.fn(),
  listarNotas: vi.fn(),
  criarNota: vi.fn(),
  editarNota: vi.fn(),
  tituloDoCaminho: (caminho: string) => caminho.split("/").pop()!.replace(/\.md$/i, ""),
}));

/** `grafo.ts` também é mockado, para testar (sem acoplar) que a escrita invalida o cache do grafo. */
vi.mock("./grafo", () => ({
  invalidarCacheDoGrafo: vi.fn(),
}));

import { buscarNotas, criarNota, editarNota, lerNota, listarNotas } from "./vault-real";
import { invalidarCacheDoGrafo } from "./grafo";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("executarFerramenta — buscar_notas", () => {
  it("repassa consulta e limite para buscarNotas e resume o resultado", async () => {
    vi.mocked(buscarNotas).mockResolvedValue({
      resultados: [
        { caminho: "Estudos/TCP.md", sha: "s1", tamanho: 10, titulo: "TCP", trecho: "...", score: 30 },
      ],
    });

    const saida = await executarFerramenta("buscar_notas", { consulta: "TCP", limite: 5 });

    expect(buscarNotas).toHaveBeenCalledWith("TCP", 5);
    expect(saida.erro).toBeUndefined();
    expect(saida.resumo).toContain("1 nota(s)");
    expect(saida.resposta.encontradas).toBe(1);
  });

  it("usa limite padrão 8 quando não informado, e não deixa passar de 20", async () => {
    vi.mocked(buscarNotas).mockResolvedValue({ resultados: [] });

    await executarFerramenta("buscar_notas", { consulta: "x" });
    expect(buscarNotas).toHaveBeenCalledWith("x", 8);

    await executarFerramenta("buscar_notas", { consulta: "x", limite: 999 });
    expect(buscarNotas).toHaveBeenCalledWith("x", 20);
  });

  it("falha com erro claro quando 'consulta' está faltando", async () => {
    const saida = await executarFerramenta("buscar_notas", {});
    expect(saida.erro).toBe(true);
    expect(saida.resumo).toMatch(/consulta/);
  });
});

describe("executarFerramenta — listar_notas", () => {
  it("lista sem pasta quando o argumento não é passado", async () => {
    vi.mocked(listarNotas).mockResolvedValue([{ caminho: "A.md", sha: "s", tamanho: 1 }]);

    const saida = await executarFerramenta("listar_notas", {});
    expect(listarNotas).toHaveBeenCalledWith(undefined);
    expect(saida.resposta.total).toBe(1);
  });

  it("filtra por pasta quando informada", async () => {
    vi.mocked(listarNotas).mockResolvedValue([]);

    await executarFerramenta("listar_notas", { pasta: "Estudos/Redes" });
    expect(listarNotas).toHaveBeenCalledWith("Estudos/Redes");
  });
});

describe("executarFerramenta — ler_nota", () => {
  it("devolve o conteúdo quando a nota existe", async () => {
    vi.mocked(lerNota).mockResolvedValue({
      nota: { caminho: "Estudos/TCP.md", sha: "s1", tamanho: 10 },
      conteudo: "# TCP\nConteúdo.",
    });

    const saida = await executarFerramenta("ler_nota", { caminho: "TCP" });
    expect(saida.erro).toBeUndefined();
    expect(saida.resposta.conteudo).toBe("# TCP\nConteúdo.");
    expect(saida.resposta.titulo).toBe("TCP");
  });

  it("devolve erro (sem lançar exceção) quando a nota não existe", async () => {
    vi.mocked(lerNota).mockResolvedValue(null);

    const saida = await executarFerramenta("ler_nota", { caminho: "Nao/Existe.md" });
    expect(saida.erro).toBe(true);
    expect(saida.resumo).toMatch(/não encontrada/);
  });
});

describe("executarFerramenta — criar_nota", () => {
  it("cria a nota e invalida o cache do grafo depois do commit", async () => {
    vi.mocked(criarNota).mockResolvedValue({
      caminho: "Estudos/DNS.md",
      criada: true,
      commitUrl: "https://github.com/usuario/vault/commit/abc",
    });

    const saida = await executarFerramenta("criar_nota", {
      caminho: "Estudos/DNS.md",
      conteudo: "# DNS",
    });

    expect(criarNota).toHaveBeenCalledWith("Estudos/DNS.md", "# DNS");
    expect(saida.erro).toBeUndefined();
    expect(saida.resposta).toEqual({
      sucesso: true,
      caminho: "Estudos/DNS.md",
      commit: "https://github.com/usuario/vault/commit/abc",
    });
    expect(saida.resumo).toMatch(/Criou/);
    expect(invalidarCacheDoGrafo).toHaveBeenCalledTimes(1);
  });

  it("devolve erro (sem lançar exceção) quando a nota já existe, e NÃO invalida o cache", async () => {
    vi.mocked(criarNota).mockRejectedValue(new Error('A nota "Estudos/TCP.md" já existe.'));

    const saida = await executarFerramenta("criar_nota", {
      caminho: "Estudos/TCP.md",
      conteudo: "x",
    });

    expect(saida.erro).toBe(true);
    expect(saida.resumo).toMatch(/já existe/);
    expect(invalidarCacheDoGrafo).not.toHaveBeenCalled();
  });

  it("falha com erro claro quando 'conteudo' está faltando", async () => {
    const saida = await executarFerramenta("criar_nota", { caminho: "Estudos/DNS.md" });
    expect(saida.erro).toBe(true);
    expect(saida.resumo).toMatch(/conteudo/);
    expect(criarNota).not.toHaveBeenCalled();
  });
});

describe("executarFerramenta — editar_nota", () => {
  it("edita no modo pedido e invalida o cache do grafo depois do commit", async () => {
    vi.mocked(editarNota).mockResolvedValue({
      caminho: "Estudos/TCP.md",
      criada: false,
      commitUrl: "https://github.com/usuario/vault/commit/def",
    });

    const saida = await executarFerramenta("editar_nota", {
      caminho: "TCP",
      conteudo: "Parágrafo novo.",
      modo: "acrescentar",
    });

    expect(editarNota).toHaveBeenCalledWith("TCP", "Parágrafo novo.", "acrescentar");
    expect(saida.resposta.modo).toBe("acrescentar");
    expect(saida.resumo).toMatch(/Complementou/);
    expect(invalidarCacheDoGrafo).toHaveBeenCalledTimes(1);
  });

  it("usa 'acrescentar' como padrão quando 'modo' vem inválido ou ausente", async () => {
    vi.mocked(editarNota).mockResolvedValue({
      caminho: "Estudos/TCP.md",
      criada: false,
      commitUrl: "url",
    });

    await executarFerramenta("editar_nota", { caminho: "TCP", conteudo: "x" });
    expect(editarNota).toHaveBeenCalledWith("TCP", "x", "acrescentar");

    await executarFerramenta("editar_nota", { caminho: "TCP", conteudo: "x", modo: "apagar_tudo" });
    expect(editarNota).toHaveBeenLastCalledWith("TCP", "x", "acrescentar");
  });

  it("devolve erro (sem lançar exceção) quando a nota não é encontrada, e NÃO invalida o cache", async () => {
    vi.mocked(editarNota).mockRejectedValue(new Error("Não encontrei a nota."));

    const saida = await executarFerramenta("editar_nota", {
      caminho: "Nao Existe",
      conteudo: "x",
      modo: "acrescentar",
    });

    expect(saida.erro).toBe(true);
    expect(invalidarCacheDoGrafo).not.toHaveBeenCalled();
  });
});

describe("declaracoesDeFerramentas", () => {
  it("declara as cinco ferramentas (leitura e escrita)", () => {
    const nomes = declaracoesDeFerramentas.map((d) => d.name);
    expect(nomes).toEqual([
      "buscar_notas",
      "listar_notas",
      "ler_nota",
      "criar_nota",
      "editar_nota",
    ]);
  });
});

describe("executarFerramenta — despacho geral", () => {
  it("devolve erro para uma ferramenta desconhecida, sem lançar exceção", async () => {
    const saida = await executarFerramenta("ferramenta_que_nao_existe", {});
    expect(saida.erro).toBe(true);
    expect(saida.resumo).toMatch(/desconhecida/);
  });

  it("captura exceções da camada de dados e devolve como erro normal", async () => {
    vi.mocked(buscarNotas).mockRejectedValue(new Error("GitHub caiu"));

    const saida = await executarFerramenta("buscar_notas", { consulta: "TCP" });
    expect(saida.erro).toBe(true);
    expect(saida.resumo).toBe("GitHub caiu");
  });
});
