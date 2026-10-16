import { afterEach, expect, it, vi } from "vitest";
import { executarFerramenta } from "../ferramentas";
import { criarRepositorioEmMemoria } from "../repositorio-de-notas/memoria";
import { codificarIdDoGithub } from "../repositorio-de-notas/github-somente-leitura";
import type { RepositorioDeNotas } from "../repositorio-de-notas/tipos";

const semear = () => criarRepositorioEmMemoria([{ titulo: "TCP", conteudo: "Original" }]);
afterEach(() => vi.restoreAllMocks());

it.each([true, false])("substituir exige ler_nota antes (escrita: %s)", async (escrita) => {
  const repo = semear();
  const atualizarNota = vi.fn(repo.atualizarNota);
  const editarNota = vi.fn();
  const saida = await executarFerramenta("editar_nota", { caminho: "TCP", conteudo: "Novo", modo: "substituir" }, {
    repositorio: { ...repo, capacidades: { escrita, datas: false }, atualizarNota }, legado: { criarNota: vi.fn(), editarNota },
  });
  expect(saida.resumo).toMatch(/ler_nota/);
  expect(saida.erro).toBe(true);
  expect(atualizarNota).not.toHaveBeenCalled();
  expect(editarNota).not.toHaveBeenCalled();
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
it("legado recusa título inválido e edição ambígua sem gravar", async () => {
  const repo = criarRepositorioEmMemoria([{ titulo: "TCP", pasta: "A" }, { titulo: "TCP", pasta: "B" }]);
  const legado = { criarNota: vi.fn(), editarNota: vi.fn() };
  const contexto = { repositorio: { ...repo, capacidades: { escrita: false, datas: false } }, legado };
  expect((await executarFerramenta("criar_nota", { caminho: "Ruim#.md", conteudo: "x" }, contexto)).resumo).toMatch(/título não pode/);
  expect((await executarFerramenta("editar_nota", { caminho: "TCP", conteudo: "x" }, contexto)).resumo).toMatch(/caminho completo/);
  expect(legado.criarNota).not.toHaveBeenCalled();
  expect(legado.editarNota).not.toHaveBeenCalled();
});
it("sucesso legado identifica diretamente sem reler a árvore que falharia", async () => {
  const listarResumos = vi.fn().mockRejectedValue(new Error("árvore indisponível"));
  const repo = { ...semear(), capacidades: { escrita: false, datas: false }, listarResumos };
  const legado = { criarNota: vi.fn(async () => ({ caminho: "Nova.md", commitUrl: "commit" })), editarNota: vi.fn() };
  const saida = await executarFerramenta("criar_nota", { caminho: "Nova.md", conteudo: "x" }, { repositorio: repo, legado });
  expect(saida.notaId).toBe(codificarIdDoGithub("Nova.md"));
  expect(saida.erro).toBeUndefined();
  expect(listarResumos).not.toHaveBeenCalled();
});
it("ler_nota registra o mesmo id usado pela substituição legada, sem relistar após gravar", async () => {
  const repo = semear();
  const nota = (await repo.listarComConteudo())[0];
  const id = codificarIdDoGithub("TCP.md");
  const listarResumos = vi.fn().mockResolvedValueOnce([{ ...nota, id }]).mockResolvedValueOnce([{ ...nota, id }])
    .mockRejectedValue(new Error("árvore indisponível depois da escrita"));
  const repositorio = { ...repo, capacidades: { escrita: false, datas: false }, listarResumos, obterNota: async () => ({ ...nota, id, revisao: 0 }) };
  const legado = { criarNota: vi.fn(), editarNota: vi.fn(async () => ({ caminho: "TCP.md", commitUrl: "commit" })) };
  const leituras = new Map<string, number>();
  await executarFerramenta("ler_nota", { caminho: "TCP" }, { repositorio, leituras });
  expect(leituras.get(id)).toBe(0);
  const saida = await executarFerramenta("editar_nota", { caminho: "TCP", conteudo: "Novo", modo: "substituir" }, { repositorio, legado, leituras });
  expect(saida.erro).toBeUndefined();
  expect(saida.notaId).toBe(id);
  expect(legado.editarNota).toHaveBeenCalledWith("TCP.md", "Novo", "substituir");
  expect(listarResumos).toHaveBeenCalledTimes(2);
});
