import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { criarSalvamentoAutomatico } from "./salvamento-automatico";

const nota = (conteudo: string, revisao = 2) => ({ id: "1", titulo: "Nota", pasta: null, tags: [], criadoEm: null, atualizadoEm: null, conteudo, revisao });
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());
function preparar() {
  const salvar = vi.fn().mockImplementation(async (texto: string) => ({ tipo: "ok", nota: nota(texto) }));
  return { salvar, maquina: criarSalvamentoAutomatico({ nota: nota("a", 1), salvar }) };
}
it("espera 3 segundos e não repete texto salvo", async () => {
  const { salvar, maquina } = preparar();
  maquina.mudar("b"); await vi.advanceTimersByTimeAsync(2999); expect(salvar).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1); expect(salvar).toHaveBeenCalledWith("b", 1, { checkpoint: false, keepalive: false });
  maquina.mudar("b"); await vi.advanceTimersByTimeAsync(3000); expect(salvar).toHaveBeenCalledTimes(1);
});
it("limita digitação contínua a 30 segundos", async () => {
  const { salvar, maquina } = preparar();
  for (let i = 0; i < 15; i++) { maquina.mudar(String(i)); await vi.advanceTimersByTimeAsync(2000); }
  expect(salvar).toHaveBeenCalledTimes(1);
});
it("serializa alterações durante voo e usa a revisão devolvida", async () => {
  const { salvar, maquina } = preparar();
  let concluir!: (valor: unknown) => void;
  salvar.mockImplementationOnce(() => new Promise((resolve) => { concluir = resolve; }));
  maquina.mudar("b"); const pedido = maquina.forcar({ checkpoint: true });
  maquina.mudar("c"); await Promise.resolve(); expect(salvar).toHaveBeenCalledTimes(1);
  concluir({ tipo: "ok", nota: nota("b", 8) }); await pedido;
  expect(salvar.mock.calls[1]).toEqual(["c", 8, { checkpoint: true, keepalive: false }]);
});
it("repete falhas com recuo de 5, 15 e 30 segundos", async () => {
  const { salvar, maquina } = preparar(); salvar.mockRejectedValue(new Error("rede"));
  maquina.mudar("b"); await vi.advanceTimersByTimeAsync(3000);
  expect(maquina.obter().estado).toBe("erro");
  for (const espera of [5000, 15000, 30000, 30000]) { const antes = salvar.mock.calls.length; await vi.advanceTimersByTimeAsync(espera - 1); expect(salvar).toHaveBeenCalledTimes(antes); await vi.advanceTimersByTimeAsync(1); expect(salvar).toHaveBeenCalledTimes(antes + 1); }
  salvar.mockImplementation(async (texto: string) => ({ tipo: "ok", nota: nota(texto) }));
  await vi.advanceTimersByTimeAsync(30000); expect(maquina.obter().estado).toBe("salvo");
});
it("conflito congela inclusive forçar; resolução explícita usa revisão atual", async () => {
  const { salvar, maquina } = preparar(); salvar.mockResolvedValueOnce({ tipo: "conflito", atual: nota("outra", 7) });
  maquina.mudar("minha"); await maquina.forcar({ checkpoint: true });
  maquina.mudar("minha nova"); await maquina.forcar({ checkpoint: true }); await vi.advanceTimersByTimeAsync(60000);
  expect(salvar).toHaveBeenCalledTimes(1); expect(maquina.obter().texto).toBe("minha nova");
  await maquina.resolver("manter"); expect(salvar.mock.calls[1][1]).toBe(7);
});
it("destruir e descartar cancelam timers", async () => {
  const { salvar, maquina } = preparar(); maquina.mudar("b"); maquina.descartar(); await vi.advanceTimersByTimeAsync(4000); expect(salvar).not.toHaveBeenCalled();
  maquina.mudar("c"); maquina.destruir(); await vi.advanceTimersByTimeAsync(4000); expect(salvar).not.toHaveBeenCalled();
});
it("Ctrl+S sem alterações não afeta o checkpoint da próxima edição", async () => {
  const { salvar, maquina } = preparar(); await maquina.forcar({ checkpoint: true }); expect(salvar).not.toHaveBeenCalled();
  maquina.mudar("b"); await vi.advanceTimersByTimeAsync(3000); expect(salvar.mock.calls[0][2].checkpoint).toBe(false);
});
it("uma sessão de autosave é fechada com checkpoint mesmo sem texto novo", async () => {
  const { salvar, maquina } = preparar(); maquina.mudar("b"); await vi.advanceTimersByTimeAsync(3000);
  await maquina.forcar({ checkpoint: true }); expect(salvar.mock.calls[1]).toEqual(["b", 2, { checkpoint: true, keepalive: false }]);
  await maquina.forcar({ checkpoint: true }); expect(salvar).toHaveBeenCalledTimes(2);
});

it("digita??o durante voo aguarda debounce depois da resposta", async () => {
  const { salvar, maquina } = preparar();
  let concluir!: (valor: unknown) => void;
  salvar.mockImplementationOnce(() => new Promise(resolve => { concluir = resolve; }));
  maquina.mudar("b"); await vi.advanceTimersByTimeAsync(3000);
  maquina.mudar("c"); concluir({ tipo: "ok", nota: nota("b", 3) }); await vi.advanceTimersByTimeAsync(0);
  expect(salvar).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(2999); expect(salvar).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1); expect(salvar.mock.calls[1][1]).toBe(3);
});
it.each([false, true])("resposta perdida reconhece texto enviado, keepalive=%s", async (keepalive) => {
  const { salvar, maquina } = preparar();
  salvar.mockResolvedValueOnce({ tipo: "conflito", atual: nota("b", 5) });
  maquina.mudar("b"); await maquina.forcar({ checkpoint: true, keepalive });
  expect(maquina.obter().estado).toBe("salvo"); expect(maquina.obter().nota.revisao).toBe(5);
});
it("conflito igual ao envio avança revisão preservando texto digitado durante o voo", async () => {
  const { salvar, maquina } = preparar(); let concluir!: (r: unknown) => void;
  salvar.mockImplementationOnce(() => new Promise(resolve => { concluir = resolve; }));
  maquina.mudar("b"); await vi.advanceTimersByTimeAsync(3000); maquina.mudar("c");
  concluir({ tipo: "conflito", atual: nota("b", 6) }); await vi.advanceTimersByTimeAsync(0);
  expect(maquina.obter()).toMatchObject({ texto: "c", estado: "pendente", nota: { revisao: 6 } });
  await vi.advanceTimersByTimeAsync(3000); expect(salvar.mock.calls[1]).toEqual(["c", 6, { checkpoint: false, keepalive: false }]);
});
it.each(["destruir", "descartar"] as const)("ignora resposta tardia ap?s %s", async (acao) => {
  const { salvar, maquina } = preparar(); let concluir!: (valor: unknown) => void;
  salvar.mockImplementationOnce(() => new Promise(resolve => { concluir = resolve; }));
  maquina.mudar("b"); const pedido = maquina.forcar({ checkpoint: true }); await Promise.resolve();
  maquina[acao](); concluir({ tipo: "ok", nota: nota("b", 5) }); await pedido;
  expect(maquina.obter().nota.revisao).toBe(1);
});
it("manter texto igual ao atual termina salvo", async () => {
  const { maquina } = preparar(); maquina.recuperarConflito("igual", nota("igual", 5));
  await maquina.resolver("manter"); expect(maquina.obter().estado).toBe("salvo");
});
it("for?ar durante voo que falha mant?m checkpoint e retry na aba oculta", async () => {
  const { salvar, maquina } = preparar(); let falhar!: (e: Error) => void;
  salvar.mockImplementationOnce(() => new Promise((_, reject) => { falhar = reject; }));
  maquina.mudar("b"); await vi.advanceTimersByTimeAsync(3000);
  const pedido = maquina.forcar({ checkpoint: true }); maquina.habilitar(false);
  falhar(new Error("rede")); await pedido; await vi.advanceTimersByTimeAsync(5000);
  expect(salvar.mock.calls[1][2].checkpoint).toBe(true);
});
