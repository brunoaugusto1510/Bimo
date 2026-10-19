import { afterEach, expect, it, vi } from "vitest";
import { criarSalvamentoAutomatico } from "./salvamento-automatico";
const nota = (conteudo: string, revisao: number) => ({ id: "n", titulo: "Título", pasta: null, tags: [], criadoEm: null, atualizadoEm: null, conteudo, revisao });
afterEach(() => vi.useRealTimers());
it("checkpoint precede renomeação; preserva digitação e usa revisão renomeada", async () => {
 vi.useFakeTimers();
 const salvar = vi.fn(async (conteudo: string, revisao: number) => ({ tipo: "ok" as const, nota: nota(conteudo, revisao + 1) }));
 const maquina = criarSalvamentoAutomatico({ nota: nota("a", 1), salvar });
 let concluir!: () => void;
 maquina.mudar("b");
 const operacao = maquina.executarExclusivo(async (revisao) => {
  expect(revisao).toBe(2); expect(salvar.mock.calls[0]).toEqual(["b", 1, { checkpoint: true, keepalive: false }]);
  await new Promise<void>((r) => concluir = r);
  maquina.rebasear({ ...nota("b", 3), titulo: "Novo" });
 });
 await vi.advanceTimersByTimeAsync(0);
 maquina.mudar("digitado no meio"); await vi.advanceTimersByTimeAsync(4000); expect(salvar).toHaveBeenCalledTimes(1);
 concluir(); await operacao;
 expect(maquina.obter().texto).toBe("digitado no meio");
 await maquina.forcar({ checkpoint: false }); expect(salvar.mock.calls[1][1]).toBe(3);
 maquina.destruir();
});
it("rebase com conteúdo diferente abre conflito", () => {
 const maquina = criarSalvamentoAutomatico({ nota: nota("a", 1), salvar: vi.fn() });
 maquina.mudar("local"); maquina.rebasear(nota("mudou", 2));
 expect(maquina.obter()).toMatchObject({ texto: "local", estado: "conflito" }); maquina.destruir();
});

it("forçar concorrente salva texto mesmo se a renomeação rejeitar", async () => {
 vi.useFakeTimers();
 const salvar = vi.fn(async (conteudo: string, revisao: number) => ({ tipo: "ok" as const, nota: nota(conteudo, revisao + 1) }));
 const maquina = criarSalvamentoAutomatico({ nota: nota("a", 1), salvar });
 let rejeitar!: (erro: Error) => void;
 const operacao = maquina.executarExclusivo(() => new Promise((_, r) => { rejeitar = r; }));
 const recusada = expect(operacao).rejects.toThrow("rede");
 await vi.advanceTimersByTimeAsync(0);
 maquina.mudar("texto preservado");
 const forca = maquina.forcar({ checkpoint: true });
 rejeitar(new Error("rede"));
 await recusada; await forca;
 expect(salvar).toHaveBeenCalledWith("texto preservado", 1, { checkpoint: true, keepalive: false });
 maquina.destruir();
});
it("checkpoint espera revalidação de uma nota reescrita", async () => {
 vi.useFakeTimers();
 const salvar = vi.fn(async (conteudo: string, revisao: number) => ({ tipo: "ok" as const, nota: nota(conteudo, revisao + 1) }));
 const maquina = criarSalvamentoAutomatico({ nota: nota("[[Antigo]]", 1), salvar });
 let concluir!: (n: ReturnType<typeof nota>) => void;
 maquina.mudar("digitado durante revalidação");
 const leitura = maquina.revalidarReescrita(() => new Promise((r) => { concluir = r; }));
 await vi.advanceTimersByTimeAsync(0);
 const checkpoint = maquina.forcar({ checkpoint: true });
 expect(salvar).not.toHaveBeenCalled();
 concluir(nota("[[Novo]]", 2)); await leitura; await checkpoint;
 expect(salvar).toHaveBeenCalledWith("digitado durante revalidação", 2, { checkpoint: true, keepalive: false });
 maquina.destruir();
});
