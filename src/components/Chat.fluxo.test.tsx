import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Chat from "./Chat";

function ChatControlado(props: Partial<React.ComponentProps<typeof Chat>> = {}) {
  const [rascunho, setRascunho] = useState("");
  return <Chat rascunho={rascunho} onRascunhoChange={setRascunho} {...props} />;
}

/** Um fluxo NDJSON que entrega as linhas uma de cada vez, só quando o teste solta. */
function fluxoControlado() {
  const codificador = new TextEncoder();
  let controle!: ReadableStreamDefaultController<Uint8Array>;
  const corpo = new ReadableStream<Uint8Array>({ start: (c) => { controle = c; } });
  return {
    resposta: new Response(corpo, { status: 200, headers: { "Content-Type": "application/x-ndjson; charset=utf-8" } }),
    linha: (objeto: unknown) => controle.enqueue(codificador.encode(`${JSON.stringify(objeto)}\n`)),
    fechar: () => controle.close(),
  };
}

const passo = (nome: string, resumo: string, ids: string[]) => ({ tipo: "passo", nome, resumo, erro: false, ids, argumentos: {} });

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("Chat — passos do agente ao vivo", () => {
  it("pede NDJSON, repassa cada passo ao grafo e mostra o que o Bimo está fazendo", async () => {
    const usuario = userEvent.setup();
    const fluxo = fluxoControlado();
    const buscarFetch = vi.fn().mockResolvedValue(fluxo.resposta);
    vi.stubGlobal("fetch", buscarFetch);
    const aoIniciarResposta = vi.fn();
    const aoPassoDoAgente = vi.fn();
    const aoEncerrarResposta = vi.fn();
    render(<ChatControlado aoIniciarResposta={aoIniciarResposta} aoPassoDoAgente={aoPassoDoAgente} aoEncerrarResposta={aoEncerrarResposta} />);

    await usuario.type(screen.getByPlaceholderText("Pergunte, peça uma nota nova ou uma edição…"), "O que é TCP?");
    await usuario.click(screen.getByRole("button", { name: "Enviar" }));
    fluxo.linha(passo("buscar_notas", 'Buscou "tcp" — 2 nota(s)', ["a", "b"]));
    fluxo.linha(passo("ler_nota", 'Leu "Redes/TCP"', ["a"]));

    // Cada passo vira uma pílula assim que chega; a última pílula é o Bimo ainda pensando.
    await waitFor(() => expect(screen.getByRole("list", { name: "O que o Bimo fez" })).toHaveTextContent('Leu "Redes/TCP"'));
    expect(screen.getByRole("list", { name: "O que o Bimo fez" })).toHaveTextContent('Buscou "tcp" — 2 nota(s)');
    expect(screen.getByRole("list", { name: "O que o Bimo fez" })).toHaveTextContent("Pensando…");
    expect(buscarFetch.mock.calls[0][1].headers).toMatchObject({ Accept: "application/x-ndjson" });
    expect(aoIniciarResposta).toHaveBeenCalledTimes(1);
    expect(aoPassoDoAgente.mock.calls.map(([p]) => p)).toEqual([
      { tipo: "busca", ids: ["a", "b"] },
      { tipo: "leitura", id: "a" },
    ]);
    expect(aoEncerrarResposta).not.toHaveBeenCalled();

    fluxo.linha({ tipo: "resposta", resposta: "TCP é confiável.", ferramentas: [] });
    fluxo.fechar();

    await waitFor(() => expect(screen.getByText("TCP é confiável.")).toBeInTheDocument());
    expect(aoEncerrarResposta).toHaveBeenCalledTimes(1);
  });

  it("as notas lidas viram fontes da resposta, com o título atual, e acendem no cérebro", async () => {
    const usuario = userEvent.setup();
    const fluxo = fluxoControlado();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(fluxo.resposta));
    const aoMostrarNoCerebro = vi.fn();
    const titulos: Record<string, string> = { a: "TCP (atual)" };
    render(<ChatControlado aoAbrirNota={vi.fn()} aoMostrarNoCerebro={aoMostrarNoCerebro} tituloDaNota={(id) => titulos[id]} />);

    await usuario.type(screen.getByPlaceholderText("Pergunte, peça uma nota nova ou uma edição…"), "O que é TCP?");
    await usuario.click(screen.getByRole("button", { name: "Enviar" }));
    fluxo.linha(passo("buscar_notas", 'Buscou "tcp" — 2 nota(s)', ["a", "b"]));
    fluxo.linha({ ...passo("ler_nota", 'Leu "Redes/TCP"', ["a"]), argumentos: { caminho: "Redes/TCP" } });
    fluxo.linha({ ...passo("ler_nota", 'Leu "Redes/UDP"', ["b"]), argumentos: { caminho: "Redes/UDP" } });
    fluxo.linha({ tipo: "resposta", resposta: "TCP é confiável.", ferramentas: [] });
    fluxo.fechar();

    await usuario.click(await screen.findByRole("button", { name: "TCP (atual), mostrar no cérebro" }));
    expect(aoMostrarNoCerebro).toHaveBeenCalledWith("a");
    // Sem título conhecido, vale o fim do caminho que o agente leu.
    expect(screen.getByRole("button", { name: "UDP, mostrar no cérebro" })).toBeInTheDocument();
  });

  it("avisa a nota criada já no passo, mesmo se o modelo falhar depois — e só uma vez", async () => {
    const usuario = userEvent.setup();
    const fluxo = fluxoControlado();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(fluxo.resposta));
    const aoNotaDoAgente = vi.fn();
    const alteradas: string[] = [];
    const ouvir = (evento: Event) => alteradas.push((evento as CustomEvent<{ id: string }>).detail.id);
    window.addEventListener("bimo:nota-alterada-pelo-agente", ouvir);
    render(<ChatControlado aoNotaDoAgente={aoNotaDoAgente} aoAbrirNota={vi.fn()} />);

    await usuario.type(screen.getByPlaceholderText("Pergunte, peça uma nota nova ou uma edição…"), "Cria uma nota");
    await usuario.click(screen.getByRole("button", { name: "Enviar" }));
    fluxo.linha({ ...passo("criar_nota", 'Criou a nota "Redes/Resumo"', ["nova"]), argumentos: { caminho: "Redes/Resumo" }, notaId: "nova" });
    fluxo.linha({ tipo: "erro", erro: "Não consegui responder agora. Tente de novo." });
    fluxo.fechar();

    await waitFor(() => expect(screen.getByText("Não consegui responder agora. Tente de novo.")).toBeInTheDocument());
    window.removeEventListener("bimo:nota-alterada-pelo-agente", ouvir);
    expect(aoNotaDoAgente).toHaveBeenCalledTimes(1);
    expect(aoNotaDoAgente).toHaveBeenCalledWith(expect.objectContaining({ id: "nova", titulo: "Resumo" }));
    expect(alteradas).toEqual(["nova"]);
    // A nota ficou gravada: a conversa guarda o passo e o botão para abri-la.
    expect(screen.getByRole("button", { name: "Abrir Resumo" })).toBeInTheDocument();
  });

  it("avisa cada escrita do fluxo, mesmo duas na mesma nota, sem repetir na resposta final", async () => {
    const usuario = userEvent.setup();
    const fluxo = fluxoControlado();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(fluxo.resposta));
    const alteradas: string[] = [];
    const ouvir = (evento: Event) => alteradas.push((evento as CustomEvent<{ id: string }>).detail.id);
    window.addEventListener("bimo:nota-alterada-pelo-agente", ouvir);
    render(<ChatControlado />);

    await usuario.type(screen.getByPlaceholderText("Pergunte, peça uma nota nova ou uma edição…"), "Edita TCP");
    await usuario.click(screen.getByRole("button", { name: "Enviar" }));
    const edicao = { ...passo("editar_nota", 'Editou "Redes/TCP"', ["a"]), argumentos: { caminho: "Redes/TCP" }, notaId: "a" };
    fluxo.linha(edicao);
    fluxo.linha(edicao);
    fluxo.linha({ tipo: "resposta", resposta: "Feito.", ferramentas: [edicao, edicao] });
    fluxo.fechar();

    await screen.findByText("Feito.");
    window.removeEventListener("bimo:nota-alterada-pelo-agente", ouvir);
    expect(alteradas).toEqual(["a", "a"]);
  });

  it("encerra o rastro e mostra o erro quando o fluxo traz uma falha", async () => {
    const usuario = userEvent.setup();
    const fluxo = fluxoControlado();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(fluxo.resposta));
    const aoEncerrarResposta = vi.fn();
    render(<ChatControlado aoEncerrarResposta={aoEncerrarResposta} />);

    await usuario.type(screen.getByPlaceholderText("Pergunte, peça uma nota nova ou uma edição…"), "Oi");
    await usuario.click(screen.getByRole("button", { name: "Enviar" }));
    fluxo.linha({ tipo: "erro", erro: "Não consegui responder agora. Tente de novo." });
    fluxo.fechar();

    await waitFor(() => expect(screen.getByText("Não consegui responder agora. Tente de novo.")).toBeInTheDocument());
    expect(aoEncerrarResposta).toHaveBeenCalledTimes(1);
  });
});
