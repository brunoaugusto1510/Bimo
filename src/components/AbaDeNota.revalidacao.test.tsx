import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import AbaDeNota from "./AbaDeNota";
import type { AbaDeNota as EstadoDaAba } from "@/lib/espaco-de-trabalho/estado";
const nota = { id: "1", titulo: "Nota", pasta: null, tags: [], conteudo: "inicial", revisao: 1, criadoEm: null, atualizadoEm: null };
const aba: EstadoDaAba = { tipo: "nota", chave: "aba-1", historico: { pilha: ["1"], indice: 0 }, modo: "edicao" };
const props = { notas: new Map(), aoVoltar: vi.fn(), aoAvancar: vi.fn(), aoAlternarModo: vi.fn(), aoAbrirNota: vi.fn(), aoCriarNota: vi.fn(), aoPerguntarAoBimo: vi.fn() };
beforeEach(() => { vi.useFakeTimers(); localStorage.clear(); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
it("hooks reais mantêm painel e contador durante recarga debounced por checkpoint", async () => {
  let pedidosLigacoes = 0;
  const fetchFalso = vi.fn(async (url: string, opcoes?: RequestInit) => {
    if (url.endsWith("/ligacoes")) {
      pedidosLigacoes++;
      if (pedidosLigacoes > 1) return new Promise<Response>(() => {});
      return Response.json({ ligacoes: { entrada: [{ id: "2", titulo: "Vizinha", pasta: null, trecho: "cita" }], saida: [] }, mencoesSemLigacao: [] });
    }
    if (opcoes?.method === "PATCH") return Response.json({ nota: { ...nota, ...JSON.parse(opcoes.body as string), revisao: 2 } });
    return Response.json({ nota, capacidades: { escrita: true, datas: true } });
  });
  vi.stubGlobal("fetch", fetchFalso); render(<AbaDeNota aba={aba} {...props} />); await act(async () => {});
  expect(screen.getByText("1 conexão")).toBeInTheDocument(); expect(screen.getByText("Vizinha")).toBeInTheDocument();
  fireEvent.change(screen.getByRole("textbox", { name: /Texto da nota/ }), { target: { value: "sem novas ligações" } }); await act(() => vi.advanceTimersByTimeAsync(3600));
  expect(pedidosLigacoes).toBe(1);
  fireEvent.click(screen.getByRole("button", { name: "Salvar agora" })); await act(async () => {});
  await act(() => vi.advanceTimersByTimeAsync(600)); expect(pedidosLigacoes).toBe(2);
  expect(screen.getByText("1 conexão")).toBeInTheDocument(); expect(screen.getByText("Vizinha")).toBeInTheDocument();
});
it("ativa revalida revisão nova; agente atualiza só a aba ativa sem pendência", async () => {
  let revisao = 1;
  const fetchFalso = vi.fn(async (url: string) => url.endsWith("/ligacoes")
    ? Response.json({ ligacoes: { entrada: [], saida: [] }, mencoesSemLigacao: [] })
    : Response.json({ nota: { ...nota, revisao, conteudo: `texto ${revisao}` }, capacidades: { escrita: true, datas: true } }));
  vi.stubGlobal("fetch", fetchFalso);
  const { rerender } = render(<AbaDeNota aba={aba} {...props} ativa={false} />); expect(fetchFalso).not.toHaveBeenCalled();
  rerender(<AbaDeNota aba={aba} {...props} ativa />); await act(async () => {}); expect(screen.getByRole("textbox", { name: /Texto da nota/ })).toHaveValue("texto 1");
  rerender(<AbaDeNota aba={aba} {...props} ativa={false} />); await act(async () => {}); revisao = 4;
  rerender(<AbaDeNota aba={aba} {...props} ativa />); await act(async () => {}); expect(screen.getByRole("textbox", { name: /Texto da nota/ })).toHaveValue("texto 4");
  revisao = 5; await act(async () => { window.dispatchEvent(new CustomEvent("bimo:nota-alterada-pelo-agente", { detail: { id: "1" } })); });
  expect(screen.getByRole("textbox", { name: /Texto da nota/ })).toHaveValue("texto 5");
  fireEvent.change(screen.getByRole("textbox", { name: /Texto da nota/ }), { target: { value: "local" } }); const antes = fetchFalso.mock.calls.length;
  await act(async () => { window.dispatchEvent(new CustomEvent("bimo:nota-alterada-pelo-agente", { detail: { id: "1" } })); });
  expect(fetchFalso).toHaveBeenCalledTimes(antes); expect(screen.getByRole("textbox", { name: /Texto da nota/ })).toHaveValue("local");
});
