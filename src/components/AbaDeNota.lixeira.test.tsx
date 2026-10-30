import { act, fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { AbaDeNota as EstadoDaAba } from "@/lib/espaco-de-trabalho/estado";
const nota = { id: "1", titulo: "Nota", pasta: null, tags: [], conteudo: "inicial", revisao: 1, criadoEm: null, atualizadoEm: null };
vi.mock("@/lib/espaco-de-trabalho/usar-nota", () => ({
  useNota: () => ({ estado: "pronto", dados: { nota, capacidades: { escrita: true, datas: true } }, recarregar: vi.fn() }),
  useLigacoes: () => ({ estado: "pronto", recarregar: vi.fn() }),
}));
vi.mock("@/lib/cliente-de-notas", async (importar) => ({ ...await importar<object>(), buscarTags: async () => [] }));
import AbaDeNota from "./AbaDeNota";
const aba: EstadoDaAba = { tipo: "nota", chave: "aba-1", historico: { pilha: ["1"], indice: 0 }, modo: "edicao" };
const props = { aba, notas: new Map(), aoVoltar: vi.fn(), aoAvancar: vi.fn(), aoAlternarModo: vi.fn(), aoAbrirNota: vi.fn(), aoCriarNota: vi.fn(), aoPerguntarAoBimo: vi.fn() };
beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());
async function abrirConfirmacao() {
  fireEvent.click(screen.getByRole("button", { name: "Mais opções" }));
  fireEvent.click(screen.getByRole("menuitem", { name: "Mover para a lixeira" }));
  return screen.findByRole("dialog", { name: "Mover para a lixeira?" });
}
it("pede confirmação, salva o texto pendente e só depois move com a revisão nova", async () => {
  const evento = vi.fn(); window.addEventListener("bimo:lixeira-alterada", evento);
  const fetch = vi.fn(async (_url: string, op: RequestInit) => {
    const corpo = JSON.parse(op.body as string);
    return Response.json({ nota: { ...nota, conteudo: "novo texto", revisao: corpo.revisaoBase + 1 } });
  }); vi.stubGlobal("fetch", fetch);
  const { unmount } = render(<AbaDeNota {...props} />);
  fireEvent.change(screen.getByRole("textbox", { name: /Texto da nota/ }), { target: { value: "novo texto" } });
  const dialogo = await abrirConfirmacao();
  expect(within(dialogo).getByRole("button", { name: "Cancelar" })).toHaveFocus();
  expect(fetch).not.toHaveBeenCalled();
  fireEvent.click(within(dialogo).getByRole("button", { name: "Mover para a lixeira" }));
  await waitFor(() => expect(evento).toHaveBeenCalledOnce());
  expect(fetch.mock.calls.map(([url, op]) => [url, op.method, JSON.parse(op.body as string)])).toEqual([
    ["/api/notas/1", "PATCH", { conteudo: "novo texto", revisaoBase: 1, checkpoint: true }],
    ["/api/notas/1/lixeira", "POST", { revisaoBase: 2 }],
  ]);
  expect(localStorage.getItem("bimo_rascunho:1")).toBeNull();
  unmount(); await act(async () => {}); expect(fetch).toHaveBeenCalledTimes(2);
  window.removeEventListener("bimo:lixeira-alterada", evento);
});
it("cancelar mantém nota e texto sem remover; somente leitura esconde a opção", async () => {
  const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
  const { rerender } = render(<AbaDeNota {...props} />);
  const dialogo = await abrirConfirmacao(); fireEvent.click(within(dialogo).getByRole("button", { name: "Cancelar" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument(); expect(fetch).not.toHaveBeenCalled();
  rerender(<AbaDeNota {...props} escritaDisponivel={false} />);
  fireEvent.click(screen.getByRole("button", { name: "Mais opções" }));
  expect(screen.queryByRole("menuitem", { name: "Mover para a lixeira" })).not.toBeInTheDocument();
});
it("falha ao salvar conserva o rascunho e impede a remoção", async () => {
  const fetch = vi.fn().mockRejectedValue(new Error("rede")); vi.stubGlobal("fetch", fetch);
  render(<AbaDeNota {...props} />);
  fireEvent.change(screen.getByRole("textbox", { name: /Texto da nota/ }), { target: { value: "rascunho valioso" } });
  const dialogo = await abrirConfirmacao();
  fireEvent.click(within(dialogo).getByRole("button", { name: "Mover para a lixeira" }));
  expect(await within(dialogo).findByRole("alert")).toHaveTextContent("Salve ou resolva o conflito");
  expect(fetch.mock.calls.every(([, op]) => op.method === "PATCH")).toBe(true);
  expect(screen.getByRole("textbox", { name: /Texto da nota/ })).toHaveValue("rascunho valioso");
  await waitFor(() => expect(localStorage.getItem("bimo_rascunho:1")).toContain("rascunho valioso"));
});
it("navegar para outra nota não transfere a confirmação de remoção", async () => {
  vi.stubGlobal("fetch", vi.fn());
  const { rerender } = render(<AbaDeNota {...props} />);
  await abrirConfirmacao();
  rerender(<AbaDeNota {...props} aba={{ ...aba, historico: { pilha: ["2"], indice: 0 } }} />);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
