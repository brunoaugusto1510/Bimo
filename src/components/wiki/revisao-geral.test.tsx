/** Regressões da revisão geral da Wiki Viva no cliente: cada teste reproduz uma falha encontrada antes da correção. */
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import NeuronioAberto from "./NeuronioAberto";
import PainelDaWiki from "./PainelDaWiki";

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const resumo = { resumo: { neuronios: 1, sinapses: 1, notasLidas: 3, totalDeNotas: 3, emConsolidacao: 0, impedidas: 0 }, energia: null,
  neuronios: [{ id: "n1", titulo: "Consistência", pasta: "Neurônios", estado: "em_pausa", alertas: [], afirmacoes: 1, fontes: 1, ligacoes: 0, perguntas: 0, divergencias: 0, criadoEm: new Date().toISOString() }], cobertura: null };

const selecionado = { id: "n1", titulo: "Consistência", pasta: "Neurônios", origens: [] };

it("uma falha de rede no acompanhamento mantém o cérebro na tela em vez de apagá-lo", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  try {
    let falhar = false;
    const buscar = vi.fn().mockImplementation(() => falhar ? Promise.reject(new TypeError("Failed to fetch")) : Promise.resolve(Response.json(resumo)));
    vi.stubGlobal("fetch", buscar);
    render(<PainelDaWiki tela="cerebro" selecionado={selecionado} aoFechar={vi.fn()} aoAbrirNeuronio={vi.fn()} aoVerCerebro={vi.fn()} />);
    expect(await screen.findByText(/Consistência/)).toBeInTheDocument();
    falhar = true; const antes = buscar.mock.calls.length;
    await act(async () => { await vi.advanceTimersByTimeAsync(31_000); });
    // O acompanhamento falhou de verdade, mas os dados anteriores continuam e nada aparece em inglês.
    expect(buscar.mock.calls.length).toBeGreaterThan(antes);
    expect(screen.getByText(/Consistência/)).toBeInTheDocument();
    expect(screen.queryByText(/Failed to fetch/)).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  } finally { vi.useRealTimers(); }
});

it("sessão expirada depois de uma consulta bem-sucedida aparece, mesmo com os dados anteriores na tela", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  try {
    let expirou = false;
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => expirou ? Promise.resolve(new Response("", { status: 401 })) : Promise.resolve(Response.json(resumo))));
    render(<PainelDaWiki tela="cerebro" selecionado={selecionado} aoFechar={vi.fn()} aoAbrirNeuronio={vi.fn()} aoVerCerebro={vi.fn()} />);
    expect(await screen.findByText(/Consistência/)).toBeInTheDocument();
    expirou = true;
    await act(async () => { await vi.advanceTimersByTimeAsync(31_000); });
    expect(screen.getByRole("link", { name: "Entrar novamente" })).toBeInTheDocument();
  } finally { vi.useRealTimers(); }
});

it("voltar ao Diário depois de paginar começa de novo pela primeira página", async () => {
  const proximo = { criadoEm: "2026-10-23T12:00:00.000000Z", id: "11111111-1111-4111-8111-111111111111" };
  const evento = { id: "e1", tipo: "nasceu", sinteseId: null, origemId: null, texto: "Nasceu um neurônio", criadoEm: "2026-10-23T12:00:00.000000Z" };
  const buscar = vi.fn().mockImplementation((url: string) => Promise.resolve(Response.json(url.includes("cerebro") ? resumo : { eventos: [evento], proximo: url.includes("antesEm") ? null : proximo })));
  vi.stubGlobal("fetch", buscar);
  const props = { aoFechar: vi.fn(), aoAbrirNeuronio: vi.fn(), aoVerCerebro: vi.fn() };
  const { rerender } = render(<PainelDaWiki tela="diario" {...props} />);
  await userEvent.click(await screen.findByRole("button", { name: "Ver anteriores" }));
  await waitFor(() => expect(buscar.mock.calls.some(([url]) => String(url).includes("antesEm="))).toBe(true));
  rerender(<PainelDaWiki tela="cerebro" {...props} />);
  buscar.mockClear();
  rerender(<PainelDaWiki tela="diario" {...props} />);
  await waitFor(() => expect(buscar).toHaveBeenCalledWith("/api/wiki/diario?limite=30", expect.anything()));
  expect(buscar.mock.calls.some(([url]) => String(url).includes("antesEm="))).toBe(false);
});

it("conflito ao pausar recarrega o neurônio e o clique seguinte leva a revisão nova", async () => {
  let revisao = 1; const posts: number[] = [];
  const detalhe = () => ({ nota: { id: "n1", titulo: "Consistência", pasta: "Neurônios", tags: [], criadoEm: null, atualizadoEm: null, revisao, conteudo: "# Consistência" },
    evidencias: { notaId: "n1", revisaoPublicada: revisao, fontes: [], afirmacoes: [], estrutura: { ligacoes: [], lacunas: [] } }, estadoNeuronio: "vivo", pausada: false });
  vi.stubGlobal("fetch", vi.fn().mockImplementation((_url: string, opcoes?: RequestInit) => {
    if (opcoes?.method === "POST") {
      const base = JSON.parse(String(opcoes.body)).revisaoBase as number; posts.push(base);
      return Promise.resolve(base === revisao ? Response.json({ ok: true }) : new Response("", { status: 409 }));
    }
    return Promise.resolve(Response.json(detalhe()));
  }));
  render(<NeuronioAberto id="n1" aoAbrirNota={vi.fn()} aoEditar={vi.fn()} aoPerguntar={vi.fn()} />);
  const pausar = await screen.findByRole("button", { name: "Pausar consolidação" });
  revisao = 2; // outra aba editou o neurônio
  await userEvent.click(pausar);
  expect(await screen.findByText(/foi recarregado/)).toBeInTheDocument();
  await waitFor(() => expect(posts).toEqual([1]));
  await userEvent.click(screen.getByRole("button", { name: "Pausar consolidação" }));
  await waitFor(() => expect(posts).toEqual([1, 2]));
});

it("enquanto o gerenciamento está em andamento o botão segue focável (aria-disabled) e ignora o segundo clique", async () => {
  let soltar = () => {}; let posts = 0;
  vi.stubGlobal("fetch", vi.fn().mockImplementation((_url: string, opcoes?: RequestInit) => {
    if (opcoes?.method === "POST") { posts++; return new Promise<Response>((r) => { soltar = () => r(Response.json({ ok: true })); }); }
    return Promise.resolve(Response.json({ nota: { id: "n1", titulo: "Consistência", pasta: null, tags: [], criadoEm: null, atualizadoEm: null, revisao: 1, conteudo: "# C" },
      evidencias: { notaId: "n1", revisaoPublicada: 1, fontes: [], afirmacoes: [], estrutura: { ligacoes: [], lacunas: [] } }, estadoNeuronio: "vivo", pausada: false }));
  }));
  render(<NeuronioAberto id="n1" aoAbrirNota={vi.fn()} aoEditar={vi.fn()} aoPerguntar={vi.fn()} />);
  const botao = await screen.findByRole("button", { name: "Pausar consolidação" });
  botao.focus(); await userEvent.click(botao); await userEvent.click(botao);
  expect(botao).toHaveAttribute("aria-disabled", "true"); expect(botao).not.toBeDisabled(); expect(botao).toHaveFocus();
  expect(posts).toBe(1);
  soltar();
});
