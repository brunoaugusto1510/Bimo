import { beforeEach, describe, expect, it, vi } from "vitest";
import { executarFerramenta } from "./ferramentas";

/**
 * Mocka a camada de dados (`vault-real.ts`) inteira: o que importa aqui é o
 * despacho de `executarFerramenta` e a normalização de argumentos, não a
 * lógica de busca em si (isso já está coberto em `vault-real.test.ts`).
 */
vi.mock("./vault-real", () => ({
  buscarNotas: vi.fn(),
  lerNota: vi.fn(),
  listarNotas: vi.fn(),
  tituloDoCaminho: (caminho: string) => caminho.split("/").pop()!.replace(/\.md$/i, ""),
}));

import { buscarNotas, lerNota, listarNotas } from "./vault-real";

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
