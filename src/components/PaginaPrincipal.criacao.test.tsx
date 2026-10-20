import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import PaginaPrincipal from "./PaginaPrincipal";
import { CONFIGURACAO_PADRAO } from "@/lib/fisica-do-grafo";
const contagem = vi.hoisted(() => ({ montagens: 0 }));
vi.mock("./GrafoDeFundo", async () => { const { useEffect } = await import("react"); return { default: function Grafo() { useEffect(() => { contagem.montagens++; }, []); return <div data-testid="grafo" />; } }; });
const itens = [{ tipo: "nota" as const, id: "antiga", nome: "Antiga", pasta: null }];
const grafo = { nos: [], arestas: [], configuracao: CONFIGURACAO_PADRAO };
const capacidades = { escrita: true, datas: true };
afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); });
it("Alt+N abre em edição e seleciona título; resposta antiga não fecha; chat e grafo permanecem", async () => {
 let listaAntiga!: (r: Response) => void, post!: (r: Response) => void;
 const fetch = vi.fn((url: string, opcoes?: RequestInit) => {
  if (opcoes?.method === "POST") return new Promise<Response>((r) => post = r);
  if (url.includes("grafo")) return fetch.mock.calls.filter(([u]) => String(u).includes("grafo")).length === 1 ? new Promise<Response>((r) => listaAntiga = r) : Promise.resolve(Response.json({ itens: [...itens, { tipo: "nota", id: "nova", nome: "Sem título", pasta: null }], grafo, capacidades }));
  return Promise.resolve(Response.json({ ligacoes: { entrada: [], saida: [] }, mencoesSemLigacao: [] }));
 }); vi.stubGlobal("fetch", fetch);
 render(<PaginaPrincipal itens={itens} grafo={grafo} capacidades={capacidades} />);
 const chat = screen.getByRole("textbox"), montagens = contagem.montagens;
 await act(async () => window.dispatchEvent(new Event("bimo:nota-salva")));
 fireEvent.keyDown(window, { key: "n", altKey: true }); fireEvent.keyDown(window, { key: "n", altKey: true }); fireEvent.keyDown(window, { key: "n", altKey: true, repeat: true });
 expect(fetch.mock.calls.filter(([, op]) => op?.method === "POST")).toHaveLength(1);
 expect(screen.queryByText("Criando nota…")).not.toBeInTheDocument();
 expect(await screen.findByText("Criando nota…")).toBeInTheDocument();
 await act(async () => post(Response.json({ nota: { id: "nova", titulo: "Sem título", pasta: null, conteudo: "", revisao: 1, tags: [], criadoEm: null, atualizadoEm: null } }, { status: 201 })));
 const titulo = await screen.findByRole("textbox", { name: "Título da nota" }) as HTMLInputElement;
 expect(titulo).toHaveFocus(); expect([titulo.selectionStart, titulo.selectionEnd]).toEqual([0, 10]);
 await act(async () => listaAntiga(Response.json({ itens, grafo, capacidades })));
 expect(screen.getByRole("tab", { name: "Sem título" })).toBeInTheDocument();
 expect(screen.getByPlaceholderText("Digite sua mensagem...")).toBe(chat); expect(contagem.montagens).toBe(montagens);
 expect(screen.getByText("Nota «Sem título» criada. Edite o título.")).toBeInTheDocument();
 fireEvent.keyDown(titulo, { key: "Enter" }); await waitFor(() => expect(screen.getByRole("textbox", { name: /Texto da nota/ })).toHaveFocus());
});
it("somente leitura anuncia sem chamar fetch", async () => {
 const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
 render(<PaginaPrincipal itens={itens} grafo={grafo} capacidades={{ escrita: false, datas: true }} />);
 fireEvent.keyDown(window, { key: "n", altKey: true });
 expect(await screen.findByRole("alert")).toHaveTextContent("Criar notas não está disponível no modo somente leitura."); expect(fetch).not.toHaveBeenCalled();
});
it("Option N e tecla morta em campo no Mac preservam digitação sem criar", () => {
 const plataforma = vi.spyOn(navigator, "platform", "get").mockReturnValue("MacIntel");
 const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
 try {
  render(<PaginaPrincipal itens={itens} grafo={grafo} capacidades={capacidades} />);
  const campo = screen.getByRole("textbox");
  expect(fireEvent.keyDown(campo, { key: "Dead", code: "KeyN", altKey: true })).toBe(true);
  expect(fireEvent.keyDown(campo, { key: "˜", code: "KeyN", altKey: true })).toBe(true);
  expect(fetch).not.toHaveBeenCalled();
 } finally { plataforma.mockRestore(); }
});

it("renomear atualiza aba e árvore; bloqueia texto durante o POST e encadeia revisão", async () => {
 const nota = { id: "renomeada", titulo: "Sem título", pasta: null, conteudo: "", revisao: 1, tags: [], criadoEm: null, atualizadoEm: null };
 let concluir!: (r: Response) => void;
 const fetch = vi.fn(async (url: string, opcoes?: RequestInit): Promise<Response> => {
  if (url.endsWith("/renomear")) return new Promise<Response>((r) => concluir = r);
  if (opcoes?.method === "POST") return Response.json({ nota }, { status: 201 });
  if (opcoes?.method === "PATCH") {
   const corpo = JSON.parse(opcoes.body as string);
   return Response.json({ nota: { ...nota, titulo: "Meu título", conteudo: corpo.conteudo, revisao: corpo.revisaoBase + 1 } });
  }
  if (url.includes("grafo")) return Response.json({ itens, grafo, capacidades });
  return Response.json({ ligacoes: { entrada: [], saida: [] }, mencoesSemLigacao: [] });
 }); vi.stubGlobal("fetch", fetch);
 render(<PaginaPrincipal itens={itens} grafo={grafo} capacidades={capacidades} />);
 const chat = screen.getByPlaceholderText("Digite sua mensagem..."), montagens = contagem.montagens;
 fireEvent.keyDown(window, { key: "n", altKey: true });
 const titulo = await screen.findByRole("textbox", { name: "Título da nota" });
 const editor = screen.getByRole("textbox", { name: /Texto da nota/ });
 fireEvent.change(editor, { target: { value: "antes" } });
 fireEvent.change(titulo, { target: { value: "Meu título" } }); fireEvent.keyDown(titulo, { key: "Enter" });
 await waitFor(() => expect(fetch.mock.calls.some(([url]) => url.endsWith("/renomear"))).toBe(true));
 expect(JSON.parse(fetch.mock.calls.find(([url]) => url.endsWith("/renomear"))![1]!.body as string)).toMatchObject({ revisaoBase: 2 });
 expect(editor).toHaveAttribute("readonly");
 expect(editor).toHaveAttribute("aria-busy", "true");
 await act(async () => concluir(Response.json({ nota: { ...nota, titulo: "Meu título", conteudo: "antes", revisao: 3 } })));
 expect(editor).toHaveValue("antes"); expect(editor).toHaveFocus();
 expect(editor).not.toHaveAttribute("readonly");
 fireEvent.change(editor, { target: { value: "depois" } });
 expect(screen.getByRole("tab", { name: /Meu título/ })).toBeInTheDocument();
 expect(screen.getByRole("navigation", { name: "Pastas e notas" })).toHaveTextContent("Meu título");
 expect(screen.getByPlaceholderText("Digite sua mensagem...")).toBe(chat); expect(contagem.montagens).toBe(montagens);
 fireEvent.keyDown(editor, { key: "s", ctrlKey: true });
 await waitFor(() => expect(fetch.mock.calls.filter(([, op]) => op?.method === "PATCH")).toHaveLength(2));
 const ultimo = fetch.mock.calls.filter(([, op]) => op?.method === "PATCH")[1];
 expect(JSON.parse(ultimo[1]!.body as string)).toMatchObject({ conteudo: "depois", revisaoBase: 3 });
});

it("capacidades atualizadas bloqueiam o botão Nova nota sem POST", async () => {
 const fetch = vi.fn().mockResolvedValue(Response.json({ itens, grafo, capacidades: { escrita: false, datas: true } }));
 vi.stubGlobal("fetch", fetch);
 render(<PaginaPrincipal itens={itens} grafo={grafo} capacidades={capacidades} />);
 fireEvent.click(screen.getByRole("button", { name: "Notas" }));
 await act(async () => window.dispatchEvent(new Event("bimo:nota-criada")));
 fireEvent.click(screen.getByRole("button", { name: "Nova nota" }));
 expect(screen.getByRole("alert")).toHaveTextContent(/modo somente leitura/);
 expect(fetch.mock.calls.some(([, op]) => op?.method === "POST")).toBe(false);
});
