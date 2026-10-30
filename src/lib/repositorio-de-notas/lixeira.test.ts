import { describe, expect, it } from "vitest";
import { criarRepositorioEmMemoria } from "./memoria";
const autor = { criadoPor: "usuario" as const };

describe("lixeira de notas", () => {
  it("oculta a nota de leituras, busca e edições e restaura a mesma identidade e conteúdo", async () => {
    const repo = criarRepositorioEmMemoria([{ titulo: "Origem", pasta: "Pasta", conteudo: "segredo", tags: ["estudo"] }]);
    const [nota] = await repo.listarComConteudo();
    const marca = await repo.marcaDeVersao();
    expect(await repo.moverParaLixeira(nota.id, nota.revisao)).toMatchObject({ tipo: "ok" });
    expect(await repo.marcaDeVersao()).not.toBe(marca);
    expect(await repo.obterNota(nota.id)).toBeNull();
    expect(await repo.listarResumos()).toEqual([]);
    expect(await repo.listarComConteudo()).toEqual([]);
    expect(await repo.buscarPorConteudo("segredo", 10)).toEqual([]);
    expect(await repo.atualizarNota(nota.id, { conteudo: "atrasado" }, { revisaoBase: 1, autor })).toEqual({ tipo: "nao-encontrada" });
    expect(await repo.renomearNota(nota.id, "Outra", { revisaoBase: 1, autor })).toEqual({ tipo: "nao-encontrada" });
    const [apagada] = await repo.listarLixeira();
    expect(apagada).toMatchObject({ id: nota.id, titulo: nota.titulo, removidaEm: expect.any(String) });
    expect(apagada).not.toHaveProperty("conteudo");
    expect(await repo.restaurarNota(nota.id, apagada.revisao)).toMatchObject({ tipo: "ok", nota: { ...nota, revisao: 3, atualizadoEm: expect.any(String) } });
    expect(await repo.listarLixeira()).toEqual([]);
    expect(await repo.buscarIdsPorConteudo("segredo", 10)).toEqual([nota.id]);
  });
  it("recusa revisão antiga e permite repetir pedidos confirmados sem duplicar alterações", async () => {
    const repo = criarRepositorioEmMemoria([{ titulo: "A" }]);
    expect(await repo.moverParaLixeira("ausente", 1)).toEqual({ tipo: "nao-encontrada" });
    expect(await repo.moverParaLixeira("1", 99)).toMatchObject({ tipo: "conflito" });
    expect(await repo.listarLixeira()).toEqual([]);
    await repo.moverParaLixeira("1", 1);
    const marca = await repo.marcaDeVersao();
    expect(await repo.moverParaLixeira("1", 1)).toMatchObject({ tipo: "ok" });
    expect(await repo.marcaDeVersao()).toBe(marca);
    expect(await repo.restaurarNota("1", 1)).toMatchObject({ tipo: "conflito" });
    await repo.restaurarNota("1", 2);
    expect(await repo.restaurarNota("1", 2)).toMatchObject({ tipo: "ok" });
  });
  it("libera título na lixeira e recusa restauração se outra nota ocupar o destino", async () => {
    const repo = criarRepositorioEmMemoria([{ titulo: "A", pasta: "P" }]);
    await repo.moverParaLixeira("1", 1);
    const outra = await repo.criarNota({ titulo: "a", pasta: "P" }, autor);
    expect(outra.tipo).toBe("ok");
    expect(await repo.restaurarNota("1", 2)).toMatchObject({ tipo: "titulo-em-uso" });
    expect(await repo.listarLixeira()).toHaveLength(1);
    expect(await repo.obterNota("1")).toBeNull();
    expect((await repo.listarResumos())).toHaveLength(1);
  });
});
