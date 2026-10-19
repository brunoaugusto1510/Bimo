import { act, renderHook } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useEdicaoDeNota } from "./usar-edicao-de-nota";
const salvar = vi.hoisted(() => vi.fn());
const renomear = vi.hoisted(() => vi.fn());
const buscar = vi.hoisted(() => vi.fn());
vi.mock("../cliente-de-notas", () => ({ salvarNota: salvar, renomearNota: renomear, buscarNota: buscar }));
const nota = { id: "1", titulo: "Nota", pasta: null, tags: [], criadoEm: null, atualizadoEm: null, conteudo: "inicial", revisao: 1 };
const dados = { nota, capacidades: { escrita: true, datas: true } };
beforeEach(() => { vi.useFakeTimers(); localStorage.clear(); salvar.mockReset().mockImplementation(async (_id, mudancas) => ({ tipo: "ok", nota: { ...nota, ...mudancas, revisao: 2 } })); });
afterEach(() => vi.useRealTimers());
it("salva após 3 segundos; sair da edição preserva texto e fecha checkpoint", async () => {
  const { result, rerender } = renderHook(({ modo }) => useEdicaoDeNota("1", dados, modo), { initialProps: { modo: true } });
  act(() => result.current.aoMudar("novo")); await act(() => vi.advanceTimersByTimeAsync(3000));
  expect(salvar).toHaveBeenCalledWith("1", { conteudo: "novo" }, { revisaoBase: 1, checkpoint: false }, { keepalive: false });
  rerender({ modo: false }); await act(async () => {}); expect(result.current.texto).toBe("novo");
  expect(salvar.mock.calls.at(-1)?.[2].checkpoint).toBe(true);
});
it("não grava ao abrir em Leitura; oferece recuperar cópia local", async () => {
  localStorage.setItem("bimo_rascunho:1", JSON.stringify({ conteudo: "recuperado", revisaoBase: 1, em: 1 }));
  const { result } = renderHook(() => useEdicaoDeNota("1", dados, false));
  expect(result.current.rascunhoRecuperado).toBe(true); act(() => { void result.current.resolverConflito("restaurar"); });
  expect(result.current.texto).toBe("recuperado"); await act(() => vi.advanceTimersByTimeAsync(60000)); expect(salvar).not.toHaveBeenCalled();
});
it("keepalive usa a fila e não duplica voo em hidden + pagehide", async () => {
  salvar.mockImplementation(() => new Promise(() => {}));
  const { result } = renderHook(() => useEdicaoDeNota("1", dados, true)); act(() => result.current.aoMudar("novo"));
  await act(async () => { window.dispatchEvent(new Event("pagehide")); window.dispatchEvent(new Event("pagehide")); });
  expect(salvar).toHaveBeenCalledTimes(1); expect(salvar.mock.calls[0][3]).toEqual({ keepalive: true });
});
it("corpo acima de 64KB usa cópia local e beforeunload sem enviar keepalive", async () => {
  const { result } = renderHook(() => useEdicaoDeNota("1", dados, true));
  const texto = "á".repeat(34000); act(() => result.current.aoMudar(texto));
  await act(async () => { window.dispatchEvent(new Event("pagehide")); }); expect(salvar).not.toHaveBeenCalled();
  expect(JSON.parse(localStorage.getItem("bimo_rascunho:1")!).conteudo).toBe(texto);
  const evento = new Event("beforeunload", { cancelable: true }); act(() => { window.dispatchEvent(evento); }); expect(evento.defaultPrevented).toBe(true);
});
it("um rascunho de revisão antiga congela até escolha explícita", async () => {
  localStorage.setItem("bimo_rascunho:1", JSON.stringify({ conteudo: "antigo local", revisaoBase: 0, em: 1 }));
  const { result } = renderHook(() => useEdicaoDeNota("1", dados, true));
  expect(result.current.estado).toBe("conflito"); expect(result.current.texto).toBe("antigo local");
  await act(() => vi.advanceTimersByTimeAsync(60000)); expect(salvar).not.toHaveBeenCalled();
  await act(() => result.current.resolverConflito("usar")); expect(result.current.texto).toBe("inicial"); expect(localStorage.getItem("bimo_rascunho:1")).toBeNull();
});
it("falha ao copiar preserva conflito e texto", async () => {
  salvar.mockResolvedValueOnce({ tipo: "conflito", atual: { ...nota, conteudo: "outro", revisao: 3 } });
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn().mockRejectedValue(new Error("negado")) } });
  const { result } = renderHook(() => useEdicaoDeNota("1", dados, true)); act(() => result.current.aoMudar("minha"));
  await act(() => vi.advanceTimersByTimeAsync(3000));
  await act(async () => { await expect(result.current.resolverConflito("copiar")).rejects.toThrow("preservada"); });
  expect(result.current.texto).toBe("minha"); expect(result.current.estado).toBe("conflito");
});
it("copiar com sucesso preserva conflito e texto", async () => {
  salvar.mockResolvedValueOnce({ tipo: "conflito", atual: { ...nota, conteudo: "outro", revisao: 3 } });
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn().mockResolvedValue(undefined) } });
  const { result } = renderHook(() => useEdicaoDeNota("1", dados, true)); act(() => result.current.aoMudar("minha"));
  await act(() => vi.advanceTimersByTimeAsync(3000)); await act(() => result.current.resolverConflito("copiar"));
  expect(result.current.estado).toBe("conflito"); expect(result.current.texto).toBe("minha");
});
it("normaliza CRLF na entrada sem criar pendência", () => {
  const { result } = renderHook(() => useEdicaoDeNota("1", { ...dados, nota: { ...nota, conteudo: "a\r\nb" } }, true));
  expect(result.current.texto).toBe("a\nb"); expect(result.current.pendente).toBe(false);
});
it("A para B carregando para A revisada adota revisão nova e limpa recuperação", () => {
  localStorage.setItem("bimo_rascunho:1", JSON.stringify({ conteudo: "rascunho", revisaoBase: 1, em: 1 }));
  const { result, rerender } = renderHook(({ id, valor }) => useEdicaoDeNota(id, valor, true), { initialProps: { id: "1", valor: dados as typeof dados | undefined } });
  expect(result.current.rascunhoRecuperado).toBe(true);
  rerender({ id: "2", valor: undefined }); localStorage.removeItem("bimo_rascunho:1");
  rerender({ id: "1", valor: { ...dados, nota: { ...nota, revisao: 4, conteudo: "servidor novo" } } });
  expect(result.current.rascunhoRecuperado).toBe(false); expect(result.current.texto).toBe("servidor novo");
});
it("StrictMode não duplica salvamento", async () => {
  const { result } = renderHook(() => useEdicaoDeNota("1", dados, true), { wrapper: StrictMode });
  act(() => result.current.aoMudar("novo")); await act(() => vi.advanceTimersByTimeAsync(3000));
  expect(salvar).toHaveBeenCalledTimes(1);
});
it("desmontar descarrega cópia e solicita checkpoint sem esperar rede", async () => {
  const { result, unmount } = renderHook(() => useEdicaoDeNota("1", dados, true));
  act(() => result.current.aoMudar("fechando")); unmount(); await act(async () => {});
  expect(JSON.parse(localStorage.getItem("bimo_rascunho:1")!).conteudo).toBe("fechando");
  expect(salvar).toHaveBeenCalledWith("1", { conteudo: "fechando" }, { revisaoBase: 1, checkpoint: true }, { keepalive: false });
});
it("resposta depois do desmonte não apaga o rascunho de outra instância", async () => {
  let concluir!: (r: unknown) => void;
  salvar.mockImplementationOnce(() => new Promise(resolve => { concluir = resolve; }));
  const anterior = renderHook(() => useEdicaoDeNota("1", dados, true));
  act(() => anterior.result.current.aoMudar("primeira")); await act(() => vi.advanceTimersByTimeAsync(3000)); anterior.unmount();
  const atual = renderHook(() => useEdicaoDeNota("1", dados, true));
  await act(() => atual.result.current.resolverConflito("descartar")); act(() => atual.result.current.aoMudar("segunda"));
  act(() => vi.advanceTimersByTime(500));
  await act(async () => concluir({ tipo: "ok", nota: { ...nota, conteudo: "primeira", revisao: 2 } }));
  expect(JSON.parse(localStorage.getItem("bimo_rascunho:1")!).conteudo).toBe("segunda"); expect(atual.result.current.texto).toBe("segunda");
});
it("visibilitychange hidden envia keepalive e texto grande continua no caminho automático", async () => {
  const { result } = renderHook(() => useEdicaoDeNota("1", dados, true));
  act(() => result.current.aoMudar("oculto"));
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
  await act(async () => document.dispatchEvent(new Event("visibilitychange")));
  expect(salvar.mock.calls[0][3]).toEqual({ keepalive: true });
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  act(() => result.current.aoMudar("á".repeat(34000))); await act(() => vi.advanceTimersByTimeAsync(3000));
  expect(salvar.mock.calls.at(-1)?.[3]).toEqual({ keepalive: false });
});
it("beforeunload avisa no conflito mesmo com textos iguais e ouve storage", async () => {
  localStorage.setItem("bimo_rascunho:1", JSON.stringify({ conteudo: "minha", revisaoBase: 0, em: 1 }));
  const { result } = renderHook(() => useEdicaoDeNota("1", dados, true));
  act(() => result.current.aoMudar("inicial"));
  const evento = new Event("beforeunload", { cancelable: true }); act(() => window.dispatchEvent(evento));
  expect(evento.defaultPrevented).toBe(true);
  act(() => window.dispatchEvent(new StorageEvent("storage", { key: "bimo_rascunho:1", newValue: "outro" })));
  expect(result.current.avisoLocal).toContain("Outra janela");
});

it("reconhece renomeação confirmada após resposta perdida sem conflito", async () => {
  const atual = { ...nota, titulo: "Novo", revisao: 2 };
  renomear.mockResolvedValue({ tipo: "conflito", atual });
  const registrar = vi.fn();
  const { result } = renderHook(() => useEdicaoDeNota("1", dados, true, registrar));
  await act(async () => { expect(await result.current.renomear("Novo")).toEqual(atual); });
  expect(result.current.estado).toBe("salvo");
  expect(registrar).toHaveBeenCalledWith(atual, true);
});
it.each([false, true])("renomeação com autolink adota revisão sem conflito; digitou=%s", async (digitou) => {
 const inicial = { ...dados, nota: { ...nota, conteudo: "[[Nota]]" } };
 let concluir!: (valor: unknown) => void;
 renomear.mockImplementationOnce(() => new Promise((r) => { concluir = r; }));
 const { result } = renderHook(() => useEdicaoDeNota("1", inicial, true));
 let pedido!: Promise<unknown>;
 await act(async () => { pedido = result.current.renomear("Novo"); });
 if (digitou) act(() => result.current.aoMudar("texto durante pedido"));
 await act(async () => { concluir({ tipo: "ok", nota: { ...nota, titulo: "Novo", conteudo: "[[Novo]]", revisao: 2 }, notasReescritas: 1 }); await pedido; });
 expect(result.current.estado).not.toBe("conflito");
 expect(result.current.texto).toBe(digitou ? "texto durante pedido" : "[[Novo]]");
 if (digitou) {
  await act(() => result.current.forcar({ checkpoint: true }));
  expect(salvar).toHaveBeenCalledWith("1", { conteudo: "texto durante pedido" }, { revisaoBase: 2, checkpoint: true }, { keepalive: false });
 }
});
it("revalida outra nota reescrita preservando digitação e usa a revisão nova", async () => {
 const { result } = renderHook(() => useEdicaoDeNota("1", dados, true));
 buscar.mockResolvedValueOnce({ ...dados, nota: { ...nota, conteudo: "[[Novo]]", revisao: 3 } });
 act(() => result.current.aoMudar("minha digitação"));
 await act(async () => { window.dispatchEvent(new CustomEvent("bimo:notas-reescritas", { detail: { id: "outra" } })); });
 expect(result.current.texto).toBe("minha digitação");
 await act(() => result.current.forcar({ checkpoint: true }));
 expect(salvar).toHaveBeenCalledWith("1", { conteudo: "minha digitação" }, { revisaoBase: 3, checkpoint: true }, { keepalive: false });
});
it("desmontar durante renomeação rejeitada ainda envia o texto pendente", async () => {
 let rejeitar!: (erro: Error) => void;
 renomear.mockImplementationOnce(() => new Promise((_, r) => { rejeitar = r; }));
 const { result, unmount } = renderHook(() => useEdicaoDeNota("1", dados, true));
 let pedido!: Promise<unknown>;
 await act(async () => { pedido = result.current.renomear("Novo").catch(() => {}); });
 act(() => result.current.aoMudar("antes de fechar"));
 unmount();
 await act(async () => { rejeitar(new Error("rede")); await pedido; });
 expect(salvar).toHaveBeenCalledWith("1", { conteudo: "antes de fechar" }, { revisaoBase: 1, checkpoint: true }, { keepalive: false });
});
