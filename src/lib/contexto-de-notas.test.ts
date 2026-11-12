import { describe, expect, it } from "vitest";
import { carregarContextoDeNotas, esquemaDeNotasDeContexto } from "./contexto-de-notas";
import { criarRepositorioEmMemoria } from "./repositorio-de-notas/memoria";

describe("contexto explícito de notas", () => {
  it("carrega conteúdo completo, deduplica e registra revisão/título atuais pelo ID", async () => {
    const repo = criarRepositorioEmMemoria([{ titulo: "Ideias", pasta: "Projeto", conteudo: "Texto integral\ncom detalhes" }]);
    const [resumo] = await repo.listarResumos();
    const primeiro = await carregarContextoDeNotas(repo, [resumo.id, resumo.id]);
    expect(primeiro.anexos).toEqual([{ id: resumo.id, titulo: resumo.titulo, pasta: resumo.pasta, revisao: resumo.revisao }]);
    expect(JSON.parse(primeiro.texto)[0].conteudo).toBe("Texto integral\ncom detalhes");
    const renomeada = await repo.renomearNota(resumo.id, "Plano", { revisaoBase: resumo.revisao, autor: { criadoPor: "usuario" } });
    expect(renomeada.tipo).toBe("ok");
    const segundo = await carregarContextoDeNotas(repo, [resumo.id]);
    expect(segundo.anexos[0]).toMatchObject({ id: resumo.id, titulo: "Plano", revisao: resumo.revisao + 1 });
    expect(primeiro.anexos[0].titulo).toBe("Ideias");
    await repo.atualizarNota(resumo.id, { conteudo: "Texto revisado" }, { revisaoBase: resumo.revisao + 1, autor: { criadoPor: "usuario" } });
    const terceiro = await carregarContextoDeNotas(repo, [resumo.id]);
    expect(JSON.parse(terceiro.texto)[0].conteudo).toBe("Texto revisado");
    expect(terceiro.anexos[0].revisao).toBe(resumo.revisao + 2);
  });
  it("recusa nota inexistente ou na lixeira sem usar contexto parcial", async () => {
    const repo = criarRepositorioEmMemoria([{ titulo: "Ideias", conteudo: "texto" }]);
    const [resumo] = await repo.listarResumos();
    await repo.moverParaLixeira(resumo.id, resumo.revisao);
    await expect(carregarContextoDeNotas(repo, [resumo.id, "outra-pessoa"])).rejects.toMatchObject({ status: 409, indisponiveis: [resumo.id, "outra-pessoa"] });
  });
  it("recusa conteúdo acima do orçamento sem truncar", async () => {
    const repo = criarRepositorioEmMemoria([{ titulo: "Grande", conteudo: "x".repeat(60_000) }]);
    const [resumo] = await repo.listarResumos();
    await expect(carregarContextoDeNotas(repo, [resumo.id])).rejects.toMatchObject({ status: 413 });
  });
  it("valida tipos e limite de seleção", () => {
    for (const valor of [null, [""], [42], Array.from({ length: 11 }, (_, i) => String(i))]) expect(esquemaDeNotasDeContexto.safeParse(valor).success).toBe(false);
  });
});
