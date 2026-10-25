import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import NeuronioAberto from "./NeuronioAberto";
const conteudo = (id = "n1") => ({ nota: { id, titulo: `Neurônio ${id}`, revisao: 7, conteudo: "Minha nota." }, estado: "atualizada", estadoNeuronio: "em_tensao", pausada: false, alertas: [], evidencias: { notaId: id, revisaoPublicada: 7,
  fontes: [{ id: "f1", titulo: "Origem", revisao: 2 }], afirmacoes: [{ id: "a", texto: "Uma ideia com suporte", natureza: "inferencia", evidencias: [{ fonteId: "f1", citacao: "Um trecho literal da origem", inicio: 0, fim: 25 }] }], estrutura: { ligacoes: [], lacunas: ["Como unir estas ideias?"], divergencias: [] } } });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const acoes = () => ({ aoAbrirNota: vi.fn(), aoEditar: vi.fn(), aoPerguntar: vi.fn() });
it("citação leva o foco à sinapse e a origem abre por id", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(conteudo()))); const callbacks = acoes();
  render(<NeuronioAberto id="n1" {...callbacks} />);
  await userEvent.click(await screen.findByRole("button", { name: /Ver sinapse 1/ }));
  expect(document.activeElement).toHaveTextContent("Um trecho literal");
  expect(screen.getByText("inferência do Bimo")).toBeInTheDocument();
  expect(screen.getByText("Como unir estas ideias?")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Abrir nota" })); expect(callbacks.aoAbrirNota).toHaveBeenCalledWith("f1");
});
it("pausa manda a revisão lida e conflito não aparenta sucesso", async () => {
  const buscar = vi.fn().mockImplementation((_url, opcoes) => Promise.resolve(opcoes?.method === "POST" ? new Response("", { status: 409 }) : Response.json(conteudo())));
  vi.stubGlobal("fetch", buscar); render(<NeuronioAberto id="n1" {...acoes()} />);
  await userEvent.click(await screen.findByRole("button", { name: "Pausar consolidação" }));
  expect(buscar).toHaveBeenCalledWith("/api/wiki/gerenciamento", expect.objectContaining({ method: "POST", body: JSON.stringify({ notaId: "n1", revisaoBase: 7, pausada: true }) }));
  expect(await screen.findByRole("status")).toHaveTextContent("O neurônio mudou");
  expect(screen.queryByText("Gerenciamento atualizado.")).not.toBeInTheDocument();
});
it("resposta atrasada de outra nota não substitui o neurônio atual", async () => {
  let terminar!: (r: Response) => void;
  vi.stubGlobal("fetch", vi.fn().mockImplementation((url: string) => url.endsWith("n1") ? new Promise((r) => { terminar = r; }) : Promise.resolve(Response.json(conteudo("n2")))));
  const { rerender } = render(<NeuronioAberto id="n1" {...acoes()} />);
  rerender(<NeuronioAberto id="n2" {...acoes()} />);
  expect(await screen.findByRole("heading", { name: "Neurônio n2" })).toBeInTheDocument();
  terminar(Response.json(conteudo()));
  await waitFor(() => expect(screen.queryByRole("heading", { name: "Neurônio n1" })).not.toBeInTheDocument());
});
it("uma nota manual pausada mostra o texto da pessoa, sem substituí-lo pelo snapshot do Bimo", async () => {
  const manual = { ...conteudo(), estadoNeuronio: "em_pausa", pausada: true, nota: { ...conteudo().nota, revisao: 8 }, evidencias: { ...conteudo().evidencias, gerencia: { revisao: 7, protegida: true } } };
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(manual)));
  render(<NeuronioAberto id="n1" {...acoes()} />);
  expect(await screen.findByText("Minha nota.")).toBeInTheDocument();
  expect(screen.getByText(/última síntese do Bimo/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Devolver ao Bimo" })).toBeInTheDocument();
});
