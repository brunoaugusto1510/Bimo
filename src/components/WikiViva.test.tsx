import { afterEach, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import WikiViva from "./WikiViva";
afterEach(() => vi.unstubAllGlobals());
it("seleciona notas e compila uma página por uma ação explícita", async () => {
  const buscar = vi.fn().mockImplementation(async (_url, opcoes) => {
    if (opcoes?.method === "POST") return Response.json({ tipo: "ok", nota: { id: "2" } }, { status: 201 });
    return Response.json({ paginas: [], notas: [{ id: "1", titulo: "Cache", pasta: null }], disponivel: true });
  });
  vi.stubGlobal("fetch", buscar); render(<WikiViva />);
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText("Título da página"), "Consistência");
  await user.click(await screen.findByRole("checkbox", { name: "Cache" }));
  await user.click(screen.getByRole("button", { name: "Compilar página" }));
  await waitFor(() => expect(buscar).toHaveBeenCalledWith("/api/wiki", expect.objectContaining({ method: "POST", body: JSON.stringify({ titulo: "Consistência", fontes: ["1"] }) })));
  expect(await screen.findByRole("status")).toHaveTextContent("Página salva");
});
it("mostra falha de carregamento e permite tentar novamente", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("rede"))); render(<WikiViva />);
  expect(await screen.findByRole("alert")).toHaveTextContent("carregar");
  expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeInTheDocument();
});
it("abre evidências, enriquece a mesma página com revisão e conserva as origens", async () => {
  const pagina = { id: "9", titulo: "Síntese", revisao: 2, estado: "desatualizada", fontes: 1, origens: ["1"] };
  const buscar = vi.fn().mockImplementation(async (url, opcoes) => {
    if (opcoes?.method === "POST") return Response.json({ tipo: "sem_mudanca", nota: { id: "9" } });
    if (url.includes("?id=")) return Response.json({ nota: { conteudo: "Conhecimento conectado" }, estado: "desatualizada", evidencias: {
      fontes: [{ id: "1", titulo: "Cache", revisao: 1 }], afirmacoes: [{ texto: "Afirmação", evidencias: [{ fonteId: "1", citacao: "citação original", inicio: 0, fim: 16 }] }],
    } });
    return Response.json({ paginas: [pagina], notas: [{ id: "1", titulo: "Cache" }, { id: "2", titulo: "Offline" }], disponivel: true });
  });
  vi.stubGlobal("fetch", buscar); render(<WikiViva />); const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Ler Síntese e evidências" }));
  expect(await screen.findByText("citação original")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Enriquecer Síntese" }));
  expect(screen.getByLabelText("Título da página")).toBeDisabled();
  expect(screen.getByRole("checkbox", { name: "Cache" })).toBeChecked();
  await user.click(screen.getByRole("checkbox", { name: "Offline" }));
  await user.click(screen.getByRole("button", { name: "Compilar página" }));
  await waitFor(() => expect(buscar).toHaveBeenCalledWith("/api/wiki", expect.objectContaining({ body: JSON.stringify({ titulo: "Síntese", fontes: ["1", "2"], paginaId: "9", revisaoBase: 2 }) })));
  expect(await screen.findByRole("status")).toHaveTextContent("Não foi necessário gerar novamente");
});
it("preserva seleção após recusa do servidor e protege página editada manualmente", async () => {
  vi.stubGlobal("fetch", vi.fn().mockImplementation(async (_url, opcoes) => opcoes?.method === "POST"
    ? Response.json({ erro: "As fontes mudaram." }, { status: 409 })
    : Response.json({ paginas: [{ id: "9", titulo: "Pessoal", estado: "edicao_manual", fontes: 1, origens: ["1"] }], notas: [{ id: "1", titulo: "A" }], disponivel: true })));
  render(<WikiViva />); const user = userEvent.setup();
  expect(await screen.findByRole("button", { name: "Enriquecer Pessoal" })).toBeDisabled();
  await user.type(screen.getByLabelText("Título da página"), "Nova");
  await user.click(screen.getByRole("checkbox", { name: "A" }));
  await user.click(screen.getByRole("button", { name: "Compilar página" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("As fontes mudaram");
  expect(screen.getByRole("checkbox", { name: "A" })).toBeChecked();
});
