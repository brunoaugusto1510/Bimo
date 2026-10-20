import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ErroDoCliente } from "../cliente-de-notas";
import type { PedidoDeRascunho } from "../edicao/pedido-de-rascunho";
const pedirRascunho = vi.hoisted(() => vi.fn());
vi.mock("../cliente-de-rascunho", () => ({ pedirRascunho }));
import { useRascunhoDoBimo } from "./usar-rascunho-do-bimo";

let campo: HTMLTextAreaElement;
const ref = () => ({ current: campo });
const preparar = (texto: string, inicio = texto.length, fim = inicio) => { campo.value = texto; campo.setSelectionRange(inicio, fim); };
const montar = (desabilitado = false) => renderHook(({ off }) => useRascunhoDoBimo({ campo: ref(), titulo: "Nota", desabilitado: off }), { initialProps: { off: desabilitado } });

beforeEach(() => { campo = document.createElement("textarea"); document.body.append(campo); pedirRascunho.mockReset(); });
afterEach(() => { document.body.replaceChildren(); });

it("pedir continuar manda o texto até o cursor e fica gerando até chegar a proposta", async () => {
  let concluir!: (texto: string) => void;
  pedirRascunho.mockImplementationOnce(() => new Promise<string>((r) => { concluir = r; }));
  preparar("Primeira frase");
  const { result } = montar();
  act(() => { void result.current.pedir("continuar"); });
  expect(result.current.estado).toEqual({ tipo: "gerando", acao: "continuar" });
  expect(pedirRascunho.mock.calls[0][0]).toEqual({ acao: "continuar", titulo: "Nota", antes: "Primeira frase", depois: "", trecho: "" } satisfies PedidoDeRascunho);
  await act(async () => concluir("e a segunda."));
  expect(result.current.estado).toEqual({ tipo: "proposta", acao: "continuar", texto: "e a segunda." });
  expect(result.current.aviso.texto).toMatch(/Proposta do Bimo pronta/);
});
it("sem seleção, resumir e melhorar explicam o que falta e não chamam o servidor", async () => {
  preparar("texto sem seleção", 3, 3);
  const { result } = montar();
  await act(async () => { await result.current.pedir("resumir"); });
  expect(result.current.estado).toEqual({ tipo: "erro", acao: null, mensagem: "Selecione um trecho do texto para o Bimo resumir." });
  expect(pedirRascunho).not.toHaveBeenCalled();
});
it("aceitar insere pelo campo (continuar) e volta ao estado ocioso", async () => {
  pedirRascunho.mockResolvedValueOnce("e a segunda.");
  preparar("Primeira frase");
  const { result } = montar();
  await act(async () => { await result.current.pedir("continuar"); });
  act(() => result.current.aceitar());
  expect(campo.value).toBe("Primeira frase e a segunda."); expect(result.current.estado).toEqual({ tipo: "ocioso" });
  expect(result.current.aviso.texto).toBe("Proposta aceita."); expect(campo).toHaveFocus();
});
it("melhorar troca a seleção e resumir acrescenta depois dela", async () => {
  pedirRascunho.mockResolvedValueOnce("Texto melhor.");
  preparar("um trecho ruim aqui", 3, 14);
  const { result } = montar();
  await act(async () => { await result.current.pedir("melhorar"); });
  act(() => result.current.aceitar());
  expect(campo.value).toBe("um Texto melhor. aqui");
  pedirRascunho.mockResolvedValueOnce("Resumo.");
  preparar("Texto longo. Fim.", 0, 12);
  await act(async () => { await result.current.pedir("resumir"); });
  act(() => result.current.aceitar());
  expect(campo.value).toBe("Texto longo.\n\nResumo.\n\n Fim.");
});
it("aceitar com o texto mudado depois do pedido não insere e pede de novo", async () => {
  pedirRascunho.mockResolvedValueOnce("e a segunda.");
  preparar("Primeira frase");
  const { result } = montar();
  await act(async () => { await result.current.pedir("continuar"); });
  campo.value = "Frase completamente outra";
  act(() => result.current.aceitar());
  expect(campo.value).toBe("Frase completamente outra");
  expect(result.current.estado).toMatchObject({ tipo: "erro", acao: "continuar", mensagem: "O texto mudou depois do pedido. Peça de novo." });
});
it("o erro do servidor aparece com a mensagem dele e tentar de novo repete o pedido", async () => {
  pedirRascunho.mockRejectedValueOnce(new ErroDoCliente("Muitos pedidos seguidos. Espere alguns segundos.", 429));
  preparar("Texto");
  const { result } = montar();
  await act(async () => { await result.current.pedir("continuar"); });
  expect(result.current.estado).toEqual({ tipo: "erro", acao: "continuar", mensagem: "Muitos pedidos seguidos. Espere alguns segundos." });
  pedirRascunho.mockResolvedValueOnce("ok");
  await act(async () => { await result.current.tentarDeNovo(); });
  expect(pedirRascunho).toHaveBeenCalledTimes(2); expect(result.current.estado).toMatchObject({ tipo: "proposta", texto: "ok" });
});
it("um erro inesperado não vaza detalhe: mensagem genérica", async () => {
  pedirRascunho.mockRejectedValueOnce(new Error("detalhe interno"));
  preparar("Texto");
  const { result } = montar();
  await act(async () => { await result.current.pedir("continuar"); });
  expect(result.current.estado).toEqual({ tipo: "erro", acao: "continuar", mensagem: "Não consegui gerar o rascunho agora. Tente de novo." });
});
it("cancelar interrompe o pedido, avisa e devolve o foco ao texto; a resposta que chegar depois é ignorada", async () => {
  let concluir!: (texto: string) => void; let sinal!: AbortSignal;
  pedirRascunho.mockImplementationOnce((_p: PedidoDeRascunho, s: AbortSignal) => { sinal = s; return new Promise<string>((r) => { concluir = r; }); });
  preparar("Texto");
  const { result } = montar();
  act(() => { void result.current.pedir("continuar"); });
  act(() => result.current.cancelar());
  expect(sinal.aborted).toBe(true); expect(result.current.estado).toEqual({ tipo: "ocioso" });
  expect(result.current.aviso.texto).toBe("Pedido cancelado."); expect(campo).toHaveFocus();
  await act(async () => concluir("tarde demais"));
  expect(result.current.estado).toEqual({ tipo: "ocioso" });
});
it("descartar fecha a proposta sem inserir e devolve o foco", async () => {
  pedirRascunho.mockResolvedValueOnce("x");
  preparar("Texto");
  const { result } = montar();
  await act(async () => { await result.current.pedir("continuar"); });
  act(() => result.current.descartar());
  expect(campo.value).toBe("Texto"); expect(result.current.estado).toEqual({ tipo: "ocioso" });
  expect(result.current.aviso.texto).toBe("Proposta descartada."); expect(campo).toHaveFocus();
});
it("um segundo pedido substitui o primeiro (a resposta antiga não vence a nova)", async () => {
  let concluirPrimeiro!: (texto: string) => void;
  pedirRascunho.mockImplementationOnce(() => new Promise<string>((r) => { concluirPrimeiro = r; }));
  pedirRascunho.mockResolvedValueOnce("segunda");
  preparar("Texto");
  const { result } = montar();
  act(() => { void result.current.pedir("continuar"); });
  await act(async () => { await result.current.pedir("continuar"); });
  await act(async () => concluirPrimeiro("primeira"));
  expect(result.current.estado).toMatchObject({ tipo: "proposta", texto: "segunda" });
});
it("desabilitado não pede; e se ficar desabilitado durante o pedido, cancela", async () => {
  let sinal!: AbortSignal;
  pedirRascunho.mockImplementationOnce((_p: PedidoDeRascunho, s: AbortSignal) => { sinal = s; return new Promise<string>(() => {}); });
  preparar("Texto");
  const { result, rerender } = montar(true);
  await act(async () => { await result.current.pedir("continuar"); });
  expect(pedirRascunho).not.toHaveBeenCalled();
  rerender({ off: false });
  act(() => { void result.current.pedir("continuar"); });
  rerender({ off: true });
  expect(sinal.aborted).toBe(true); expect(result.current.estado).toEqual({ tipo: "ocioso" });
});
it("aceitar num campo somente leitura não insere, avisa e MANTÉM a proposta (é passageiro, e já foi paga)", async () => {
  pedirRascunho.mockResolvedValueOnce("x");
  preparar("Texto");
  const { result } = montar();
  await act(async () => { await result.current.pedir("continuar"); });
  campo.readOnly = true;
  act(() => result.current.aceitar());
  expect(campo.value).toBe("Texto");
  expect(result.current.estado).toMatchObject({ tipo: "proposta", texto: "x" });
  expect(result.current.aviso.texto).toBe("O texto está ocupado agora. Tente aceitar de novo em instantes.");
  campo.readOnly = false;
  act(() => result.current.aceitar());
  expect(campo.value).toBe("Texto x");
});
it("avisa que o pedido saiu e, se a nota ficar ocupada no meio, que ele foi cancelado", async () => {
  pedirRascunho.mockImplementationOnce(() => new Promise<string>(() => {}));
  preparar("Texto");
  const { result, rerender } = montar();
  act(() => { void result.current.pedir("continuar"); });
  expect(result.current.aviso.texto).toBe("O Bimo está escrevendo.");
  rerender({ off: true });
  expect(result.current.aviso.texto).toBe("Pedido cancelado: a nota está sendo atualizada.");
});
it("desmontar cancela o pedido em andamento", () => {
  let sinal!: AbortSignal;
  pedirRascunho.mockImplementationOnce((_p: PedidoDeRascunho, s: AbortSignal) => { sinal = s; return new Promise<string>(() => {}); });
  preparar("Texto");
  const { result, unmount } = montar();
  act(() => { void result.current.pedir("continuar"); });
  unmount();
  expect(sinal.aborted).toBe(true);
});
