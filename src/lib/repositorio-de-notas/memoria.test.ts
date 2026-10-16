import { describe, expect, it } from "vitest";
import { criarRepositorioEmMemoria, obterRepositorioEmMemoriaCompartilhado } from "./memoria";
import { NOTAS_DE_EXEMPLO } from "./semente";
import { executarContratoDoRepositorio } from "./suite-de-contrato";

executarContratoDoRepositorio("memória", () => criarRepositorioEmMemoria());

describe("criarRepositorioEmMemoria", () => {
  it("começa com as notas iniciais", async () => {
    const repo = criarRepositorioEmMemoria([{ titulo: "A", conteudo: "x" }, { titulo: "B", pasta: "P" }]);

    const resumos = await repo.listarResumos();

    expect(resumos.map((r) => r.titulo).sort()).toEqual(["A", "B"]);
  });

  it("repositórios criados separadamente não compartilham notas", async () => {
    const um = criarRepositorioEmMemoria();
    const outro = criarRepositorioEmMemoria();

    await um.criarNota({ titulo: "Só no um" }, { criadoPor: "usuario" });

    expect(await outro.listarResumos()).toEqual([]);
  });

  it("não deixa quem recebeu uma nota alterar o que está guardado", async () => {
    const repo = criarRepositorioEmMemoria([{ titulo: "A", tags: ["x"] }]);
    const [nota] = await repo.listarComConteudo();

    nota.tags.push("intruso");
    nota.titulo = "Mudou";

    expect((await repo.listarComConteudo())[0]).toMatchObject({ titulo: "A", tags: ["x"] });
  });
});

describe("obterRepositorioEmMemoriaCompartilhado", () => {
  it("devolve sempre o mesmo repositório, já com as notas de exemplo", async () => {
    const um = obterRepositorioEmMemoriaCompartilhado();
    const outro = obterRepositorioEmMemoriaCompartilhado();

    expect(outro).toBe(um);
    expect((await um.listarResumos()).length).toBeGreaterThanOrEqual(NOTAS_DE_EXEMPLO.length);
  });
});

describe("NOTAS_DE_EXEMPLO", () => {
  it("tem títulos únicos por pasta e algumas ligações entre as notas", () => {
    const chaves = NOTAS_DE_EXEMPLO.map((n) => `${n.pasta ?? ""}/${n.titulo}`.toLowerCase());

    expect(new Set(chaves).size).toBe(chaves.length);
    expect(NOTAS_DE_EXEMPLO.some((n) => /\[\[[^\]]+\]\]/.test(n.conteudo ?? ""))).toBe(true);
  });
});
