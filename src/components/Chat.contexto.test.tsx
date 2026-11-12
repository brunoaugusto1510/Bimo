import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import type { ClienteDeConversas } from "@/lib/conversas/cliente";
import Chat from "./Chat";

const nota = { id: "n1", titulo: "Plano", pasta: "Projeto" };
const anexo = { ...nota, revisao: 4 };
const CAMPO = "Pergunte, peça uma nota nova ou uma edição…";
function Controlado(props: Partial<React.ComponentProps<typeof Chat>>) {
  const [rascunho, definirRascunho] = useState("");
  return <Chat rascunho={rascunho} onRascunhoChange={definirRascunho} notasDisponiveis={[nota]} {...props} />;
}
function cliente(): ClienteDeConversas {
  return { atualizarContexto: vi.fn(async () => {}), acrescentar: vi.fn(async () => {}), listar: vi.fn(async () => []), abrir: vi.fn(), excluir: vi.fn() };
}
function simularChat(responder: () => Response = () => Response.json({ resposta: "Resposta pronta", ferramentas: [], anexos: [anexo] })) {
  return vi.fn(async (url: string) => url.startsWith("/api/notas/") ? Response.json({ nota }) : responder());
}
afterEach(() => { vi.unstubAllGlobals(); });

it("anexa sem enviar, guarda recibo e fontes e mantém a seleção para o próximo pedido", async () => {
  const usuario = userEvent.setup(), conversas = cliente(), buscar = simularChat();
  vi.stubGlobal("fetch", buscar);
  render(<Controlado conversas={conversas} />);
  await usuario.type(screen.getByPlaceholderText(CAMPO), "Resuma o plano");
  await usuario.click(screen.getByRole("button", { name: "+ Adicionar notas" }));
  await usuario.click(screen.getByRole("checkbox", { name: /Plano/ }));
  await usuario.click(screen.getByRole("button", { name: "Adicionar" }));
  expect(screen.getByPlaceholderText(CAMPO)).toHaveValue("Resuma o plano");
  expect(buscar.mock.calls.some(([url]) => url === "/api/chat")).toBe(false);
  await waitFor(() => expect(conversas.atualizarContexto).toHaveBeenCalledWith(expect.any(String), ["n1"]));
  await usuario.click(screen.getByRole("button", { name: "Enviar" }));
  await screen.findByText("Resposta pronta");
  await waitFor(() => expect(conversas.acrescentar).toHaveBeenCalledTimes(2));
  const chamadas = vi.mocked(conversas.acrescentar).mock.calls;
  expect(chamadas[0][1][0].anexos).toEqual([anexo]);
  expect(chamadas[1][1][0].fontes).toEqual([{ id: "n1", titulo: "Plano" }]);
  expect(screen.getByRole("list", { name: "Notas anexadas ao pedido" })).toHaveTextContent("Plano");
  expect(screen.getByRole("button", { name: "Remover Plano do contexto" })).toBeInTheDocument();
  await usuario.click(screen.getByRole("button", { name: "Remover Plano do contexto" }));
  await waitFor(() => expect(conversas.atualizarContexto).toHaveBeenLastCalledWith(chamadas[0][0], []));
});

it("reabre seleção e Novo chat limpa anexos e rascunho", async () => {
  const usuario = userEvent.setup(), conversas = cliente();
  vi.mocked(conversas.listar).mockResolvedValue([{ id: "c1", titulo: "Conversa salva", atualizadaEm: "2026-11-12T12:00:00Z" }]);
  vi.mocked(conversas.abrir).mockResolvedValue({ conversa: { id: "c1", titulo: "Conversa salva", atualizadaEm: "2026-11-12T12:00:00Z" }, mensagens: [], notasDeContexto: ["n1"] });
  vi.stubGlobal("fetch", simularChat());
  render(<Controlado conversas={conversas} />);
  await usuario.click(screen.getByRole("button", { name: "Histórico" }));
  await usuario.click(await screen.findByRole("button", { name: /^Conversa salva/ }));
  await screen.findByRole("button", { name: "Remover Plano do contexto" });
  expect(conversas.atualizarContexto).not.toHaveBeenCalled();
  await usuario.type(screen.getByPlaceholderText(CAMPO), "Outra pergunta");
  await usuario.click(screen.getByRole("button", { name: "Novo chat" }));
  expect(screen.queryByRole("button", { name: "Remover Plano do contexto" })).not.toBeInTheDocument();
  expect(screen.getByPlaceholderText(CAMPO)).toHaveValue("");
});

it("preserva texto e anexos quando o servidor recusa contexto e permite recuperação", async () => {
  const usuario = userEvent.setup();
  vi.stubGlobal("fetch", simularChat(() => Response.json({ erro: "Contexto grande demais" }, { status: 413 })));
  const conversas = cliente();
  render(<Controlado conversas={conversas} notasDeContexto={["n1"]} />);
  await usuario.type(screen.getByPlaceholderText(CAMPO), "Resuma");
  await usuario.click(screen.getByRole("button", { name: "Enviar" }));
  await screen.findByText("Contexto grande demais");
  expect(screen.getByPlaceholderText(CAMPO)).toHaveValue("Resuma");
  expect(screen.getByRole("button", { name: "Remover Plano do contexto" })).toBeInTheDocument();
  expect(conversas.acrescentar).not.toHaveBeenCalled();
});

it("marca indisponíveis e bloqueia envio até remover a nota", async () => {
  const usuario = userEvent.setup();
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ erro: "Não encontrada" }, { status: 404 })));
  render(<Controlado notasDeContexto={["n1"]} />);
  await screen.findByRole("alert");
  await usuario.type(screen.getByPlaceholderText(CAMPO), "Resuma");
  expect(screen.getByRole("button", { name: "Enviar" })).toBeDisabled();
});

it("mantém a seleção local quando PATCH falha e oferece tentar novamente", async () => {
  const usuario = userEvent.setup(), conversas = cliente();
  vi.mocked(conversas.atualizarContexto).mockRejectedValueOnce(new Error("offline"));
  vi.stubGlobal("fetch", simularChat());
  render(<Controlado conversas={conversas} notasDeContexto={["n1"]} />);
  const tentar = await screen.findByRole("button", { name: "Tentar guardar novamente" });
  expect(screen.getByRole("button", { name: "Remover Plano do contexto" })).toBeInTheDocument();
  await usuario.click(tentar);
  await waitFor(() => expect(screen.queryByRole("button", { name: "Tentar guardar novamente" })).not.toBeInTheDocument());
});

it("uma falha na pergunta não deixa a resposta passar à frente no histórico", async () => {
  const usuario = userEvent.setup(), conversas = cliente();
  vi.mocked(conversas.acrescentar).mockRejectedValueOnce(new Error("offline"));
  vi.stubGlobal("fetch", simularChat(() => Response.json({ resposta: "Resposta pronta", ferramentas: [] })));
  render(<Controlado conversas={conversas} />);
  await usuario.type(screen.getByPlaceholderText(CAMPO), "Pergunta em ordem");
  await usuario.click(screen.getByRole("button", { name: "Enviar" }));
  await screen.findByText("Resposta pronta");
  await waitFor(() => expect(conversas.acrescentar).toHaveBeenCalledTimes(2));
  const repetidas = vi.mocked(conversas.acrescentar).mock.calls[1][1];
  expect(repetidas.map((m) => m.papel)).toEqual(["usuario", "agente"]);
  expect(repetidas[0].conteudo).toBe("Pergunta em ordem");
});
