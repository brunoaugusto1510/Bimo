import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import PaginaPrincipal from "../PaginaPrincipal";
import { CONFIGURACAO_PADRAO } from "@/lib/fisica-do-grafo";
import type { Grafo } from "@/lib/grafo-de-notas";
import type { ItemDeNotas } from "@/lib/types";

// O jsdom não tem canvas: o grafo de verdade não roda aqui, e este teste só observa o que a página pede ao servidor.
vi.mock("@/components/GrafoDeFundo", async () => {
  const { useImperativeHandle } = await import("react");
  return { default: function GrafoFalso({ controleRef }: { controleRef?: React.Ref<unknown> }) {
    useImperativeHandle(controleRef, () => ({ aproximar: vi.fn(), afastar: vi.fn(), enquadrar: vi.fn(), enquadrarVizinhos: vi.fn() }), []);
    return <div data-testid="grafo" />;
  } };
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const ITENS: ItemDeNotas[] = [{ tipo: "pasta", nome: "Neurônios", caminho: "Neurônios", filhos: [{ tipo: "nota", id: "10", nome: "Ler devagar", pasta: "Neurônios" }] }];
const GRAFO: Grafo = { nos: [{ tipo: "nota", id: "10", titulo: "Ler devagar", grupo: "Neurônios", neuronio: true }], arestas: [], configuracao: CONFIGURACAO_PADRAO };
const cerebro = (ids: string[]) => ({ resumo: { neuronios: ids.length, sinapses: 0, notasLidas: 1, totalDeNotas: 1, emConsolidacao: 0, impedidas: 0 }, energia: null, cobertura: null,
  neuronios: ids.map((id) => ({ id, titulo: `Neurônio ${id}`, pasta: "Neurônios", estado: "vivo", alertas: [], afirmacoes: 1, fontes: 1, ligacoes: 0, perguntas: 0, divergencias: 0, criadoEm: null })) });

it("um neurônio que nasceu em segundo plano pede a atualização do grafo, sem recarregar a página", async () => {
  vi.stubGlobal("fetch", vi.fn().mockImplementation((url: string) => Promise.resolve(url.includes("cerebro") ? Response.json(cerebro(["10", "99"])) : new Response("", { status: 500 }))));
  const aviso = vi.fn(); window.addEventListener("bimo:nota-alterada-pelo-agente", aviso);
  try {
    render(<PaginaPrincipal itens={ITENS} grafo={GRAFO} />);
    await waitFor(() => expect(aviso).toHaveBeenCalled());
  } finally { window.removeEventListener("bimo:nota-alterada-pelo-agente", aviso); }
});

it("um neurônio que o filtro do grafo oculta mas a árvore conhece não provoca atualizações repetidas", async () => {
  const itens: ItemDeNotas[] = [{ tipo: "pasta", nome: "Neurônios", caminho: "Neurônios", filhos: [
    { tipo: "nota", id: "10", nome: "Ler devagar", pasta: "Neurônios" }, { tipo: "nota", id: "99", nome: "Sem raízes", pasta: "Neurônios" }] }];
  vi.stubGlobal("fetch", vi.fn().mockImplementation((url: string) => Promise.resolve(url.includes("cerebro") ? Response.json(cerebro(["10", "99"])) : new Response("", { status: 500 }))));
  const aviso = vi.fn(); window.addEventListener("bimo:nota-alterada-pelo-agente", aviso);
  try {
    const buscar = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    render(<PaginaPrincipal itens={itens} grafo={GRAFO} />);
    await waitFor(() => expect(buscar).toHaveBeenCalledWith("/api/wiki/cerebro", expect.anything()));
    await new Promise((r) => setTimeout(r, 50));
    expect(aviso).not.toHaveBeenCalled();
  } finally { window.removeEventListener("bimo:nota-alterada-pelo-agente", aviso); }
});

it("quando o grafo já conhece todos os neurônios do cérebro nada é pedido", async () => {
  vi.stubGlobal("fetch", vi.fn().mockImplementation((url: string) => Promise.resolve(url.includes("cerebro") ? Response.json(cerebro(["10"])) : new Response("", { status: 500 }))));
  const aviso = vi.fn(); window.addEventListener("bimo:nota-alterada-pelo-agente", aviso);
  try {
    const buscar = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    render(<PaginaPrincipal itens={ITENS} grafo={GRAFO} />);
    await waitFor(() => expect(buscar).toHaveBeenCalledWith("/api/wiki/cerebro", expect.anything()));
    await new Promise((r) => setTimeout(r, 50));
    expect(aviso).not.toHaveBeenCalled();
  } finally { window.removeEventListener("bimo:nota-alterada-pelo-agente", aviso); }
});
