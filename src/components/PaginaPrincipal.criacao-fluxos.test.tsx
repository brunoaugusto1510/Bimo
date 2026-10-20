import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import PaginaPrincipal from "./PaginaPrincipal";
import { CONFIGURACAO_PADRAO } from "@/lib/fisica-do-grafo";

vi.mock("./GrafoDeFundo", () => ({ default: () => <div /> }));
const capacidades = { escrita: true, datas: true };
const grafo = { nos: [], arestas: [], configuracao: CONFIGURACAO_PADRAO };
const original = { id: "origem", titulo: "Origem", pasta: "P", conteudo: "[[Nova]]", revisao: 1, tags: [], criadoEm: null, atualizadoEm: null };
const itens = [{ tipo: "nota" as const, id: original.id, nome: original.titulo, pasta: original.pasta }];

afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); });

function preparar() {
  const fetch = vi.fn(async (url: string, opcoes?: RequestInit) => {
    if (opcoes?.method === "POST") {
      const entrada = JSON.parse(opcoes.body as string);
      return Response.json({ nota: { ...original, ...entrada, id: "nova", conteudo: "" }, capacidades }, { status: 201 });
    }
    if (url.includes("grafo")) return Response.json({ itens, grafo, capacidades });
    if (url.endsWith("/ligacoes")) return Response.json({ ligacoes: { entrada: [], saida: [] }, mencoesSemLigacao: [] });
    if (url.includes("/busca")) return Response.json({ resultados: [] });
    return Response.json({ nota: original, capacidades });
  });
  vi.stubGlobal("fetch", fetch);
  render(<PaginaPrincipal itens={itens} grafo={grafo} capacidades={capacidades} />);
  return fetch;
}

it("paleta cria pelo caminho com foco no texto e título editável", async () => {
  const fetch = preparar();
  fireEvent.keyDown(window, { key: "o", ctrlKey: true });
  const campo = screen.getByRole("combobox");
  fireEvent.change(campo, { target: { value: "Outra/Nova" } });
  fireEvent.keyDown(campo, { key: "Enter", ctrlKey: true });
  // A transição atravessa POST, fechamento da paleta e efeitos de foco.
  await waitFor(() => expect(screen.getByRole("textbox", { name: /Texto da nota/ })).toHaveFocus(), { timeout: 5000 });
  expect(screen.getByRole("textbox", { name: "Título da nota" })).toBeInTheDocument();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  const post = fetch.mock.calls.find(([, opcoes]) => opcoes?.method === "POST")!;
  expect(JSON.parse(post[1]!.body as string)).toMatchObject({ titulo: "Nova", pasta: "Outra" });
  expect(fetch.mock.calls.some(([url]) => url === "/api/notas/nova")).toBe(false);
});

it("ligação cria na mesma aba, herda a pasta e permite voltar à origem", async () => {
  const fetch = preparar();
  fireEvent.click(screen.getByRole("button", { name: "Origem" }));
  fireEvent.click(await screen.findByRole("button", { name: "Criar a nota «Nova»" }));
  await waitFor(() => expect(screen.getByRole("textbox", { name: /Texto da nota/ })).toHaveFocus(), { timeout: 5000 });
  expect(screen.getAllByRole("tab")).toHaveLength(2);
  expect(screen.getByRole("tab", { name: "Nova" })).toBeInTheDocument();
  const post = fetch.mock.calls.find(([, opcoes]) => opcoes?.method === "POST")!;
  expect(JSON.parse(post[1]!.body as string)).toMatchObject({ titulo: "Nova", pasta: "P" });
  expect(screen.getByRole("textbox", { name: "Título da nota" })).toBeInTheDocument();
  await act(async () => fireEvent.click(screen.getByRole("button", { name: /Voltar/ })));
  expect(screen.getByRole("tab", { name: "Origem" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Leitura" }));
  expect(await screen.findByRole("link", { name: "Nova" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Criar a nota «Nova»" })).not.toBeInTheDocument();
});
it("abrir pela paleta leva foco ao h1 da nota", async () => {
 preparar();
 fireEvent.keyDown(window, { key: "o", ctrlKey: true });
 fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" });
 await waitFor(() => expect(screen.getByRole("heading", { level: 1, name: "Origem" })).toHaveFocus());
});
it("falha de criação na paleta tem um único alerta preenchido", async () => {
 const fetch = preparar();
 fetch.mockImplementationOnce(async () => Response.json({ erro: "Falha na criação" }, { status: 500 }));
 fireEvent.keyDown(window, { key: "o", ctrlKey: true });
 const campo = screen.getByRole("combobox");
 fireEvent.change(campo, { target: { value: "Nova" } });
 fireEvent.keyDown(campo, { key: "Enter", ctrlKey: true });
 await waitFor(() => expect(screen.getAllByRole("alert").filter((a) => a.textContent)).toHaveLength(1));
 expect(campo).toHaveValue("Nova");
});
it("título pendente mantém edição e erro após clicar em Leitura", async () => {
 const fetch = preparar();
 fireEvent.keyDown(window, { key: "n", altKey: true });
 const titulo = await screen.findByRole("textbox", { name: "Título da nota" });
 fetch.mockImplementationOnce(async () => Response.json({ erro: "Falha ao renomear" }, { status: 500 }));
 fireEvent.change(titulo, { target: { value: "Pendente" } });
 fireEvent.blur(titulo); fireEvent.click(screen.getByRole("button", { name: "Leitura" }));
 await waitFor(() => expect(titulo).toHaveAttribute("aria-invalid", "true"), { timeout: 5000 });
 expect(titulo).toHaveValue("Pendente");
 expect(screen.getByRole("textbox", { name: /Texto da nota/ })).toBeInTheDocument();
 fireEvent.click(screen.getByRole("button", { name: "Leitura" }));
 expect(screen.getByText(/Confirme o título com Enter/)).toBeVisible();
 expect(screen.getByRole("textbox", { name: /Texto da nota/ })).toBeInTheDocument();
});
