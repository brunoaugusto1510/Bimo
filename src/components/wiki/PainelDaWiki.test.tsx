import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import PainelDaWiki from "./PainelDaWiki";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const dados = { resumo: { neuronios: 1, sinapses: 2, notasLidas: 3, totalDeNotas: 5, emConsolidacao: 2, impedidas: 0 }, energia: { teto: 100, utilizada: 25, restante: 75, renovaEm: "2026-10-24T00:00:00Z" }, neuronios: [{ id: "n1", titulo: "Consistência", estado: "vivo", fontes: 2, afirmacoes: 3, alertas: [], criadoEm: "2026-10-23T12:00:00Z" }] };
it("mostra dados reais, abre o neurônio e fecha sem navegar a página", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(dados)));
  const abrir = vi.fn(); const fechar = vi.fn();
  render(<PainelDaWiki tela="cerebro" aoFechar={fechar} aoAbrirNeuronio={abrir} aoVerCerebro={vi.fn()} />);
  await userEvent.click(await screen.findByRole("button", { name: /Consistência/ }));
  expect(abrir).toHaveBeenCalledWith("n1");
  expect(screen.getByText("3 de 5 notas lidas")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Fechar cérebro" })); expect(fechar).toHaveBeenCalled();
});
it("erro de configuração não inventa contagens nem eventos", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 503 })));
  render(<PainelDaWiki tela="diario" aoFechar={vi.fn()} aoAbrirNeuronio={vi.fn()} aoVerCerebro={vi.fn()} />);
  expect(await screen.findByRole("alert")).toHaveTextContent("não está habilitado");
  expect(screen.queryByText("Consistência")).not.toBeInTheDocument();
});
it("diário usa o cursor do mesmo período e abre o destino do evento", async () => {
  const buscar = vi.fn().mockImplementation((url: string) => Promise.resolve(Response.json(url.includes("cerebro") ? dados : { eventos: [{ id: "e1", tipo: "nasceu", sinteseId: "n1", origemId: "1", texto: "Nasceu Consistência", criadoEm: "2026-10-23T12:00:00Z" }], proximo: null })));
  vi.stubGlobal("fetch", buscar); const abrir = vi.fn();
  render(<PainelDaWiki tela="diario" aoFechar={vi.fn()} aoAbrirNeuronio={abrir} aoVerCerebro={vi.fn()} />);
  await userEvent.click(await screen.findByRole("button", { name: "Abrir neurônio" }));
  expect(abrir).toHaveBeenCalledWith("n1");
  await waitFor(() => expect(buscar).toHaveBeenCalledWith(expect.stringContaining("inicio="), expect.anything()));
});
