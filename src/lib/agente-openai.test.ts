import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { criarRepositorioEmMemoria } from "./repositorio-de-notas/memoria";
import { obterRepositorio } from "./repositorio-de-notas";
import { responder } from "./agente";

vi.mock("./repositorio-de-notas", () => ({ obterRepositorio: vi.fn() }));
vi.mock("server-only", () => ({}));
const buscar = vi.fn();
const pergunta = [{ papel: "usuario" as const, conteudo: "Reescreva TCP." }];
const chamada = (nome: string, argumentos: object, id: string) => Response.json({
  status: "completed", output: [{ type: "function_call", name: nome, arguments: JSON.stringify(argumentos), call_id: id }],
});
const final = () => Response.json({ status: "completed", output: [
  { type: "message", role: "assistant", content: [{ type: "output_text", text: "Pronto." }] },
] });
const repositorio = () => criarRepositorioEmMemoria([{ titulo: "TCP", pasta: "Redes", conteudo: "original" }]);

beforeEach(() => {
  vi.stubEnv("OPENAI_API_KEY", "falsa");
  vi.stubGlobal("fetch", buscar);
  buscar.mockReset();
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it("Responses → leitura real → substituição com revisão → resposta e passos", async () => {
  const notas = repositorio();
  vi.mocked(obterRepositorio).mockResolvedValue(notas);
  const atualizar = vi.spyOn(notas, "atualizarNota");
  buscar.mockResolvedValueOnce(chamada("ler_nota", { caminho: "Redes/TCP.md" }, "ler"))
    .mockResolvedValueOnce(chamada("editar_nota", { caminho: "Redes/TCP.md", conteudo: "novo", modo: "substituir" }, "editar"))
    .mockResolvedValueOnce(final());
  const aoPasso = vi.fn();
  const resultado = await responder(pergunta, { aoPasso });
  const [resumo] = await notas.listarResumos();
  expect((await notas.obterNota(resumo.id))?.conteudo).toBe("novo");
  expect(atualizar).toHaveBeenCalledWith(resumo.id, { conteudo: "novo" }, expect.objectContaining({ revisaoBase: resumo.revisao - 1 }));
  expect(resultado.ferramentas.map((f) => f.nome)).toEqual(["ler_nota", "editar_nota"]);
  expect(aoPasso.mock.calls[1][0].ids).toEqual([resumo.id]);
});

it("não substitui sem leitura anterior na mesma execução", async () => {
  const notas = repositorio();
  vi.mocked(obterRepositorio).mockResolvedValue(notas);
  const atualizar = vi.spyOn(notas, "atualizarNota");
  buscar.mockResolvedValueOnce(chamada("editar_nota", { caminho: "Redes/TCP.md", conteudo: "novo", modo: "substituir" }, "editar"))
    .mockResolvedValueOnce(final());
  const resultado = await responder(pergunta);
  expect(atualizar).not.toHaveBeenCalled();
  expect(resultado.ferramentas[0].erro).toBe(true);
  expect(JSON.parse(buscar.mock.calls[1][1].body).input.at(-1).output).toContain("ler_nota");
});

it("preserva a edição concorrente e não repete a substituição em conflito", async () => {
  const notas = repositorio();
  vi.mocked(obterRepositorio).mockResolvedValue(notas);
  const [antes] = await notas.listarResumos();
  buscar.mockResolvedValueOnce(chamada("ler_nota", { caminho: "Redes/TCP.md" }, "ler"))
    .mockImplementationOnce(async () => {
      await notas.atualizarNota(antes.id, { conteudo: "outra pessoa" }, { revisaoBase: antes.revisao, autor: { criadoPor: "usuario" } });
      return chamada("editar_nota", { caminho: "Redes/TCP.md", conteudo: "novo", modo: "substituir" }, "editar");
    }).mockResolvedValueOnce(final());
  const atualizar = vi.spyOn(notas, "atualizarNota");
  const resultado = await responder(pergunta);
  expect((await notas.obterNota(antes.id))?.conteudo).toBe("outra pessoa");
  expect(resultado.ferramentas[1].erro).toBe(true);
  expect(atualizar).toHaveBeenCalledTimes(2);
});

it("não acrescenta duas vezes quando o modelo repete a escrita com outro identificador", async () => {
  const notas = repositorio();
  vi.mocked(obterRepositorio).mockResolvedValue(notas);
  const atualizar = vi.spyOn(notas, "atualizarNota");
  const argumentos = { caminho: "Redes/TCP.md", conteudo: "acréscimo", modo: "acrescentar" };
  buscar.mockResolvedValueOnce(chamada("editar_nota", argumentos, "a"))
    .mockResolvedValueOnce(chamada("editar_nota", argumentos, "b"))
    .mockResolvedValueOnce(final());
  await responder(pergunta);
  expect(atualizar).toHaveBeenCalledTimes(1);
});
