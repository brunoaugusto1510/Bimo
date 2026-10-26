import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import PainelDaWiki from "./PainelDaWiki";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const dados = { resumo: { neuronios: 1, sinapses: 2, notasLidas: 3, totalDeNotas: 5, emConsolidacao: 2, impedidas: 0 }, energia: { teto: 100, utilizada: 25, restante: 75, renovaEm: "2026-10-24T00:00:00Z" }, neuronios: [{ id: "n1", titulo: "Consistência", estado: "vivo", fontes: 2, afirmacoes: 3, alertas: [], criadoEm: "2026-10-23T12:00:00Z" }] };
it("mostra o cartão do neurônio escolhido, filtra e fecha sem navegar a página", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(dados)));
  const abrir = vi.fn(); const fechar = vi.fn(); const filtrar = vi.fn();
  const selecionado = { id: "n1", titulo: "Consistência", pasta: "Engenharia", origens: ["Cache no app", "Sync offline"] };
  render(<PainelDaWiki tela="cerebro" selecionado={selecionado} aoFiltrar={filtrar} aoFechar={fechar} aoAbrirNeuronio={abrir} aoVerCerebro={vi.fn()} />);
  expect(await screen.findByText("Liga “Cache no app” e “Sync offline”.")).toBeInTheDocument();
  expect(screen.getByText("Neurônio · Engenharia · 2 notas de origem · 3 afirmações")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Abrir neurônio" }));
  expect(abrir).toHaveBeenCalledWith("n1");
  await userEvent.click(screen.getByRole("button", { name: "Só neurônios" })); expect(filtrar).toHaveBeenCalledWith("neuronios");
  expect(screen.getByText("2 notas na fila para consolidar")).toBeInTheDocument();
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
  expect(screen.getByText("de 5 notas lidas")).toBeInTheDocument();
  // A primeira página não fixa `fim`: o servidor usa "agora", e a consulta de 30 s enxerga eventos que nasceram depois da abertura.
  await waitFor(() => expect(buscar).toHaveBeenCalledWith("/api/wiki/diario?limite=30", expect.anything()));
  expect(buscar.mock.calls.some(([url]) => String(url).includes("fim="))).toBe(false);
});
it("diário agrupa as leituras sem novidade, resume o período e abre a nota de um evento sem neurônio", async () => {
  const eventos = [
    { id: "e1", tipo: "nasceu", sinteseId: "n1", origemId: "1", texto: "Nasceu o neurônio “Consistência”.", criadoEm: "2026-10-23T12:00:00Z" },
    { id: "e2", tipo: "sem_novidade", sinteseId: null, origemId: "2", texto: "Lista de compras", criadoEm: "2026-10-23T11:00:00Z" },
    { id: "e3", tipo: "sem_novidade", sinteseId: null, origemId: "3", texto: "Ideias soltas", criadoEm: "2026-10-23T10:00:00Z" },
    { id: "e4", tipo: "precisa_de_voce", sinteseId: null, origemId: "4", texto: "Decisão adiada.", criadoEm: "2026-10-23T09:00:00Z" },
  ];
  vi.stubGlobal("fetch", vi.fn().mockImplementation((url: string) => Promise.resolve(Response.json(url.includes("cerebro") ? dados : { eventos, proximo: null }))));
  const abrirNota = vi.fn();
  render(<PainelDaWiki tela="diario" aoFechar={vi.fn()} aoAbrirNeuronio={vi.fn()} aoAbrirNota={abrirNota} aoVerCerebro={vi.fn()} />);
  expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent(/Fiz 1 neurônio novo, li 2 notas sem nada novo e tenho 1 pergunta para você\.$/);
  expect(screen.getByText("Li 2 notas e não havia nada novo para ligar")).toBeInTheDocument();
  // O título do neurônio já está no texto do evento: não aparece de novo como título do cartão.
  expect(screen.queryByRole("heading", { name: "Consistência" })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Abrir nota" }));
  expect(abrirNota).toHaveBeenCalledWith("4");
});
