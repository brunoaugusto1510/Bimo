import { useState } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ClienteDeConversas } from "@/lib/conversas/cliente";
import type { ConversaCompleta, ResumoDeConversa } from "@/lib/conversas/tipos";
import type { Mensagem } from "@/lib/types";
import Chat from "./Chat";

function ChatControlado(props: Partial<React.ComponentProps<typeof Chat>> = {}) {
  const [rascunho, setRascunho] = useState("");
  return <Chat rascunho={rascunho} onRascunhoChange={setRascunho} {...props} />;
}

const CAMPO = "Pergunte, peça uma nota nova ou uma edição…";

function clienteFalso(guardadas: ConversaCompleta[] = []): ClienteDeConversas & { [K in keyof ClienteDeConversas]: ReturnType<typeof vi.fn> } {
  return {
    listar: vi.fn(async (): Promise<ResumoDeConversa[]> => guardadas.map((c) => c.conversa)),
    abrir: vi.fn(async (id: string) => {
      const achada = guardadas.find((c) => c.conversa.id === id);
      if (!achada) throw new Error("Conversa não encontrada.");
      return achada;
    }),
    acrescentar: vi.fn(async () => {}),
    excluir: vi.fn(async () => {}),
  };
}

function conversaGuardada(id: string, titulo: string, mensagens: Mensagem[]): ConversaCompleta {
  return { conversa: { id, titulo, atualizadaEm: "2026-10-29T12:30:00.000Z" }, mensagens };
}

function responderCom(resposta: string) {
  const buscar = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ resposta, ferramentas: [] }) });
  vi.stubGlobal("fetch", buscar);
  return buscar;
}

async function perguntar(usuario: ReturnType<typeof userEvent.setup>, texto: string) {
  await usuario.type(screen.getByPlaceholderText(CAMPO), texto);
  await usuario.click(screen.getByRole("button", { name: "Enviar" }));
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("Chat — novo chat e histórico", () => {
  it("sem um lugar para guardar, não mostra os botões", () => {
    render(<ChatControlado />);

    expect(screen.queryByRole("button", { name: "Histórico" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Novo chat" })).not.toBeInTheDocument();
  });

  it("guarda a pergunta e a resposta na mesma conversa, na ordem", async () => {
    const usuario = userEvent.setup();
    responderCom("TCP é confiável.");
    const conversas = clienteFalso();
    render(<ChatControlado conversas={conversas} />);

    await perguntar(usuario, "O que é TCP?");

    await waitFor(() => expect(conversas.acrescentar).toHaveBeenCalledTimes(2));
    const [[idDaPergunta, [pergunta]], [idDaResposta, [resposta]]] = conversas.acrescentar.mock.calls;
    expect(idDaPergunta).toBe(idDaResposta);
    expect(pergunta).toMatchObject({ papel: "usuario", conteudo: "O que é TCP?" });
    expect(resposta).toMatchObject({ papel: "agente", conteudo: "TCP é confiável." });
  });

  it("Novo chat fica desabilitado numa conversa vazia e, depois, começa outra conversa", async () => {
    const usuario = userEvent.setup();
    responderCom("Resposta.");
    const conversas = clienteFalso();
    render(<ChatControlado conversas={conversas} />);
    expect(screen.getByRole("button", { name: "Novo chat" })).toBeDisabled();

    await perguntar(usuario, "Primeira conversa");
    await screen.findByText("Resposta.");
    await usuario.click(screen.getByRole("button", { name: "Novo chat" }));

    expect(screen.queryByText("Resposta.")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Converse com as suas notas" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Novo chat" })).toBeDisabled();

    await perguntar(usuario, "Segunda conversa");
    await screen.findByText("Resposta.");
    const idsUsados = new Set(conversas.acrescentar.mock.calls.map(([id]) => id));
    expect(idsUsados.size).toBe(2);
  });

  it("a conversa nova não leva o que foi dito na anterior para o agente", async () => {
    const usuario = userEvent.setup();
    const buscar = responderCom("Resposta.");
    render(<ChatControlado conversas={clienteFalso()} />);

    await perguntar(usuario, "Algo antigo");
    await screen.findByText("Resposta.");
    await usuario.click(screen.getByRole("button", { name: "Novo chat" }));
    await perguntar(usuario, "Algo novo");
    await waitFor(() => expect(buscar).toHaveBeenCalledTimes(2));

    expect(JSON.parse(buscar.mock.calls[1][1].body)).toEqual({ mensagens: [{ papel: "usuario", conteudo: "Algo novo" }] });
  });

  it("Novo chat espera o Bimo terminar de responder", async () => {
    const usuario = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    render(<ChatControlado conversas={clienteFalso()} />);

    await perguntar(usuario, "Demora");

    expect(screen.getByRole("button", { name: "Novo chat" })).toBeDisabled();
  });

  it("lista as conversas guardadas e reabre a escolhida, que continua de onde parou", async () => {
    const usuario = userEvent.setup();
    const buscar = responderCom("Mais uma.");
    const antiga = conversaGuardada("11111111-1111-4111-8111-111111111111", "Estudo de redes", [
      { id: "m1", papel: "usuario", conteudo: "Fale de redes" },
      { id: "m2", papel: "agente", conteudo: "Redes conectam máquinas." },
    ]);
    const conversas = clienteFalso([antiga, conversaGuardada("22222222-2222-4222-8222-222222222222", "Receitas", [{ id: "m3", papel: "usuario", conteudo: "Bolo" }])]);
    render(<ChatControlado conversas={conversas} />);

    await usuario.click(screen.getByRole("button", { name: "Histórico" }));
    const lista = await screen.findByRole("region", { name: "Histórico de conversas" });
    expect(await within(lista).findByText("Receitas")).toBeInTheDocument();
    await usuario.click(within(lista).getByRole("button", { name: /^Estudo de redes/ }));

    expect(await screen.findByText("Redes conectam máquinas.")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Histórico de conversas" })).not.toBeInTheDocument();

    await perguntar(usuario, "E camadas?");
    await screen.findByText("Mais uma.");
    // O agente recebe a conversa reaberta inteira, e a nova pergunta é gravada nela, não numa conversa nova.
    expect(JSON.parse(buscar.mock.calls[0][1].body).mensagens.map((m: Mensagem) => m.conteudo)).toEqual(["Fale de redes", "Redes conectam máquinas.", "E camadas?"]);
    expect(conversas.acrescentar.mock.calls[0][0]).toBe(antiga.conversa.id);
  });

  it("manda ao agente só o fim de uma conversa longa reaberta, para a rota não recusar", async () => {
    const usuario = userEvent.setup();
    const buscar = responderCom("Ok.");
    const longa = Array.from({ length: 60 }, (_, i): Mensagem => ({ id: `m${i}`, papel: i % 2 === 0 ? "usuario" : "agente", conteudo: `texto ${i}` }));
    render(<ChatControlado conversas={clienteFalso([conversaGuardada("33333333-3333-4333-8333-333333333333", "Longa", longa)])} />);

    await usuario.click(screen.getByRole("button", { name: "Histórico" }));
    await usuario.click(await screen.findByRole("button", { name: /^Longa/ }));
    await screen.findByText("texto 59");
    await perguntar(usuario, "Continua");
    await screen.findByText("Ok.");

    const enviadas = JSON.parse(buscar.mock.calls[0][1].body).mensagens;
    expect(enviadas.length).toBeLessThanOrEqual(40);
    expect(enviadas.at(-1)).toEqual({ papel: "usuario", conteudo: "Continua" });
    expect(enviadas[0].papel).toBe("usuario");
  });

  it("apagar a conversa que está na tela volta ao chat vazio, depois de confirmar", async () => {
    const usuario = userEvent.setup();
    responderCom("Resposta.");
    const conversas = clienteFalso();
    render(<ChatControlado conversas={conversas} />);
    await perguntar(usuario, "Vou apagar");
    await screen.findByText("Resposta.");
    const idDaConversa = conversas.acrescentar.mock.calls[0][0] as string;
    conversas.listar.mockResolvedValue([{ id: idDaConversa, titulo: "Vou apagar", atualizadaEm: "2026-10-29T12:30:00.000Z" }]);

    await usuario.click(screen.getByRole("button", { name: "Histórico" }));
    await usuario.click(await screen.findByRole("button", { name: /Apagar a conversa/ }));
    expect(conversas.excluir).not.toHaveBeenCalled();
    await usuario.click(screen.getByRole("button", { name: "Apagar" }));

    await waitFor(() => expect(conversas.excluir).toHaveBeenCalledWith(idDaConversa));
    expect(await screen.findByRole("heading", { name: "Converse com as suas notas" })).toBeInTheDocument();
    expect(screen.queryByText("Resposta.")).not.toBeInTheDocument();
  });

  it("avisa quando não consegue guardar, sem perder a conversa da tela", async () => {
    const usuario = userEvent.setup();
    responderCom("Resposta.");
    const conversas = clienteFalso();
    conversas.acrescentar.mockRejectedValue(new Error("fora do ar"));
    render(<ChatControlado conversas={conversas} />);

    await perguntar(usuario, "Pergunta");

    expect(await screen.findByText(/Não consegui guardar esta conversa no histórico/)).toBeInTheDocument();
    expect(screen.getByText("Resposta.")).toBeInTheDocument();
  });

  it("mostra o erro ao carregar o histórico e, na vez seguinte, a lista vazia com uma frase", async () => {
    const usuario = userEvent.setup();
    const conversas = clienteFalso();
    conversas.listar.mockRejectedValueOnce(new Error("Não consegui carregar o histórico."));
    render(<ChatControlado conversas={conversas} />);

    await usuario.click(screen.getByRole("button", { name: "Histórico" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Não consegui carregar o histórico.");

    await usuario.click(screen.getByRole("button", { name: "Histórico" }));
    await usuario.click(screen.getByRole("button", { name: "Histórico" }));
    expect(await screen.findByText(/Nenhuma conversa guardada ainda/)).toBeInTheDocument();
  });

  it("com um lugar indicado, os botões aparecem nele e não no alto do chat", () => {
    const barra = document.createElement("div");
    document.body.append(barra);
    const { container } = render(<ChatControlado conversas={clienteFalso()} lugarDosBotoes={barra} />);

    expect(within(barra).getByRole("button", { name: "Histórico" })).toBeInTheDocument();
    expect(within(barra).getByRole("button", { name: "Novo chat" })).toBeInTheDocument();
    expect(within(container).queryByRole("button", { name: "Histórico" })).not.toBeInTheDocument();
    barra.remove();
  });

  it("some da barra quando o chat fica escondido e não aparece em lugar nenhum enquanto a barra não existe", () => {
    const barra = document.createElement("div");
    document.body.append(barra);
    const { rerender } = render(<ChatControlado conversas={clienteFalso()} lugarDosBotoes={barra} ativo={false} />);
    expect(within(barra).queryByRole("button", { name: "Histórico" })).not.toBeInTheDocument();

    rerender(<ChatControlado conversas={clienteFalso()} lugarDosBotoes={null} />);

    expect(screen.queryByRole("button", { name: "Histórico" })).not.toBeInTheDocument();
    barra.remove();
  });

  it("Escape fecha a lista", async () => {
    const usuario = userEvent.setup();
    render(<ChatControlado conversas={clienteFalso()} />);

    await usuario.click(screen.getByRole("button", { name: "Histórico" }));
    expect(await screen.findByRole("region", { name: "Histórico de conversas" })).toBeInTheDocument();
    await usuario.keyboard("{Escape}");

    expect(screen.queryByRole("region", { name: "Histórico de conversas" })).not.toBeInTheDocument();
  });
});
