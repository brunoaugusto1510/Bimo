/** O cérebro dentro da página principal: seleção, filtros e descoberta do primeiro neurônio. */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import PaginaPrincipal from "../PaginaPrincipal";
import { CONFIGURACAO_PADRAO } from "@/lib/fisica-do-grafo";
import type { Grafo } from "@/lib/grafo-de-notas";
import type { ItemDeNotas } from "@/lib/types";

// O jsdom não tem canvas: o grafo falso mostra o que a página pede a ele e deixa escolher o neurônio "10".
vi.mock("@/components/GrafoDeFundo", async () => {
  const { useImperativeHandle } = await import("react");
  return { default: function GrafoFalso({ controleRef, selecionado, onSelecionar }: { controleRef?: React.Ref<unknown>; selecionado?: string | null; onSelecionar?: (id: string | null) => void }) {
    useImperativeHandle(controleRef, () => ({ aproximar: vi.fn(), afastar: vi.fn(), enquadrar: vi.fn(), enquadrarVizinhos: vi.fn() }), []);
    return <div data-testid="grafo" data-selecionado={selecionado ?? ""}><button type="button" onClick={() => onSelecionar?.("10")}>escolher neurônio</button></div>;
  } };
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const ITENS: ItemDeNotas[] = [{ tipo: "pasta", nome: "Neurônios", caminho: "Neurônios", filhos: [{ tipo: "nota", id: "10", nome: "Ler devagar", pasta: "Neurônios" }] }];
const COM_NEURONIO: Grafo = { nos: [{ tipo: "nota", id: "10", titulo: "Ler devagar", grupo: "Neurônios", neuronio: true }], arestas: [], configuracao: CONFIGURACAO_PADRAO };
const cerebro = (ids: string[]) => ({ resumo: { neuronios: ids.length, sinapses: 0, notasLidas: 1, totalDeNotas: 1, emConsolidacao: 0, impedidas: 0 }, energia: null, cobertura: null,
  neuronios: ids.map((id) => ({ id, titulo: `Neurônio ${id}`, pasta: "Neurônios", estado: "vivo", alertas: [], afirmacoes: 1, fontes: 1, ligacoes: 0, perguntas: 0, divergencias: 0, criadoEm: null })) });

it("um filtro que esconde o neurônio escolhido tira o cartão e o foco do grafo", async () => {
  vi.stubGlobal("fetch", vi.fn().mockImplementation((url: string) => Promise.resolve(url.includes("cerebro") ? Response.json(cerebro(["10"])) : new Response("", { status: 500 }))));
  const usuario = userEvent.setup();
  render(<PaginaPrincipal itens={ITENS} grafo={COM_NEURONIO} />);
  await usuario.click(screen.getByRole("button", { name: "Cérebro" }));
  await usuario.click(await screen.findByRole("button", { name: "escolher neurônio" }));
  expect(await screen.findByRole("region", { name: "Neurônio selecionado" })).toHaveTextContent("Ler devagar");
  expect(screen.getByTestId("grafo")).toHaveAttribute("data-selecionado", "10");
  // O neurônio está vivo e sem alertas: "Precisam de você" não o inclui.
  await usuario.click(screen.getByRole("button", { name: /^Precisam de você/ }));
  expect(screen.queryByRole("region", { name: "Neurônio selecionado" })).not.toBeInTheDocument();
  expect(screen.getByTestId("grafo")).toHaveAttribute("data-selecionado", "");
  expect(screen.getByText("Nenhum neurônio precisa de você agora.")).toBeInTheDocument();
  // De volta a "Tudo", a mesma escolha volta a valer.
  await usuario.click(screen.getByRole("button", { name: "Tudo" }));
  expect(screen.getByTestId("grafo")).toHaveAttribute("data-selecionado", "10");
});

it("com o cérebro aberto e nenhum neurônio no grafo, o primeiro que nasce em segundo plano é descoberto", async () => {
  const semNeuronio: Grafo = { nos: [{ tipo: "nota", id: "10", titulo: "Ler devagar", grupo: "Neurônios" }], arestas: [], configuracao: CONFIGURACAO_PADRAO };
  vi.stubGlobal("fetch", vi.fn().mockImplementation((url: string) => Promise.resolve(url.includes("cerebro") ? Response.json(cerebro(["99"])) : new Response("", { status: 500 }))));
  const aviso = vi.fn(); window.addEventListener("bimo:nota-alterada-pelo-agente", aviso);
  try {
    render(<PaginaPrincipal itens={ITENS} grafo={semNeuronio} />);
    await userEvent.click(screen.getByRole("button", { name: "Cérebro" }));
    await waitFor(() => expect(aviso).toHaveBeenCalled());
  } finally { window.removeEventListener("bimo:nota-alterada-pelo-agente", aviso); }
});
