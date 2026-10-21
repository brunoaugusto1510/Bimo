import { afterEach, expect, it, vi } from "vitest";
import { executarFerramenta } from "../ferramentas";
import { criarRepositorioEmMemoria } from "../repositorio-de-notas/memoria";
import type { RepositorioDeNotas } from "../repositorio-de-notas/tipos";

const semear = () => criarRepositorioEmMemoria([{ titulo: "TCP", conteudo: "Original" }]);
afterEach(() => vi.restoreAllMocks());

it("substituir exige ler_nota antes", async () => {
  const repo = semear();
  const atualizarNota = vi.fn(repo.atualizarNota);
  const saida = await executarFerramenta("editar_nota", { caminho: "TCP", conteudo: "Novo", modo: "substituir" }, {
    repositorio: { ...repo, atualizarNota },
  });
  expect(saida.resumo).toMatch(/ler_nota/);
  expect(saida.erro).toBe(true);
  expect(atualizarNota).not.toHaveBeenCalled();
});
it("substituir usa a revisão realmente lida e não repete conflito", async () => {
  const repo = semear();
  const leituras = new Map<string, number>();
  await executarFerramenta("ler_nota", { caminho: "TCP" }, { repositorio: repo, leituras });
  const nota = (await repo.listarResumos())[0];
  expect(leituras.get(nota.id)).toBe(1);
  await repo.atualizarNota(nota.id, { conteudo: "Salvo pela pessoa" }, { revisaoBase: 1, autor: { criadoPor: "usuario" } });
  const atualizarNota = vi.fn(repo.atualizarNota);
  const saida = await executarFerramenta("editar_nota", { caminho: "TCP", conteudo: "Novo", modo: "substituir" }, { repositorio: { ...repo, atualizarNota }, leituras });
  expect(saida.resumo).toMatch(/mudou.*Leia a nota novamente/);
  expect(atualizarNota).toHaveBeenCalledTimes(1);
  expect(atualizarNota.mock.calls[0][2].revisaoBase).toBe(1);
  expect((await repo.obterNota(nota.id))?.conteudo).toBe("Salvo pela pessoa");
});
it("edição não usa substring, mas leitura continua tolerante", async () => {
  const repo = criarRepositorioEmMemoria([{ titulo: "TCP Avançado", conteudo: "Original" }]);
  expect((await executarFerramenta("ler_nota", { caminho: "TCP" }, { repositorio: repo })).erro).toBeUndefined();
  expect((await executarFerramenta("editar_nota", { caminho: "TCP", conteudo: "Novo" }, { repositorio: repo })).erro).toBe(true);
  expect((await repo.listarComConteudo())[0].conteudo).toBe("Original");
});
it("concatena aviso do repositório e limite da listagem", async () => {
  const repo = criarRepositorioEmMemoria(Array.from({ length: 201 }, (_, i) => ({ titulo: `Nota ${i}` })));
  const saida = await executarFerramenta("listar_notas", {}, { repositorio: { ...repo, obterAviso: async () => "Lista parcial." } });
  expect(saida.resposta.aviso).toContain("Lista parcial.");
  expect(saida.resposta.aviso).toContain("primeiros 200");
});
it("não expõe SQL nem parâmetros de falha interna, mas registra no servidor", async () => {
  const erro = new Error("SQL INSERT INTO notas PARAMS conteúdo confidencial");
  const registrar = vi.spyOn(console, "error").mockImplementation(() => {});
  const saida = await executarFerramenta("listar_notas", {}, { repositorio: { ...semear(), listarResumos: async () => { throw erro; } } });
  expect(saida).toEqual({ erro: true, resumo: "Falha interna ao acessar as notas. Tente novamente.", resposta: { erro: "Falha interna ao acessar as notas. Tente novamente." } });
  expect(registrar).toHaveBeenCalledWith(expect.stringContaining("listar_notas"), erro);
});
it("preserva mensagem esperada sem log interno", async () => {
  const registrar = vi.spyOn(console, "error").mockImplementation(() => {});
  const saida = await executarFerramenta("buscar_notas", {}, { repositorio: semear() });
  expect(saida.resumo).toContain('O parâmetro "consulta" é obrigatório');
  expect(registrar).not.toHaveBeenCalled();
});
it("distingue ausência de nota que sumiu entre listar e ler", async () => {
  const repo = { ...semear(), obterNota: async () => null };
  const ausente = await executarFerramenta("ler_nota", { caminho: "Ausente" }, { repositorio: repo });
  const sumiu = await executarFerramenta("ler_nota", { caminho: "TCP" }, { repositorio: repo });
  expect(ausente.resumo).toMatch(/não encontrada/);
  expect(sumiu.resumo).toMatch(/sumiu/);
});
it.each(["titulo-em-uso", "somente-leitura"] as const)("trata %s depois do retry de acrescentar", async (tipo) => {
  const repo = semear();
  const atual = (await repo.listarComConteudo())[0];
  const atualizarNota = vi.fn<RepositorioDeNotas["atualizarNota"]>()
    .mockResolvedValueOnce({ tipo: "conflito", atual })
    .mockResolvedValueOnce(tipo === "titulo-em-uso" ? { tipo, idExistente: atual.id } : { tipo });
  const saida = await executarFerramenta("editar_nota", { caminho: "TCP", conteudo: "Novo" }, { repositorio: { ...repo, atualizarNota } });
  expect(atualizarNota).toHaveBeenCalledTimes(2);
  expect(saida.resumo).toMatch(tipo === "titulo-em-uso" ? /editar_nota/ : /modo leitura/);
});
