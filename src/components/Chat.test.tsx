import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Chat from "./Chat";

/**
 * `Chat` recebe `rascunho`/`onRascunhoChange` de fora (o texto do campo mora
 * no componente pai, porque clicar numa nota da barra lateral também escreve
 * nele). Este wrapper reproduz esse contrato para o teste poder digitar de
 * verdade — sem ele, `rascunho` nunca mudaria, porque `Chat` não tem estado
 * próprio para o campo.
 */
function ChatControlado(props: Partial<React.ComponentProps<typeof Chat>> = {}) {
  const [rascunho, setRascunho] = useState("");
  return <Chat rascunho={rascunho} onRascunhoChange={setRascunho} {...props} />;
}

function mockFetch(resposta: { ok: boolean; corpo: unknown }) {
  return vi.fn().mockResolvedValue({
    ok: resposta.ok,
    json: async () => resposta.corpo,
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("Chat", () => {
  it("envia a mensagem, mostra a resposta do agente e os resumos das ferramentas usadas", async () => {
    const usuario = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      mockFetch({
        ok: true,
        corpo: {
          resposta: "TCP faz handshake de three-way, segundo Estudos/Redes/TCP.md.",
          ferramentas: [
            { nome: "buscar_notas", argumentos: { consulta: "TCP" }, resumo: 'Buscou "TCP" — 1 nota(s)' },
          ],
        },
      }),
    );

    render(<ChatControlado />);

    await usuario.type(screen.getByPlaceholderText("Digite sua mensagem..."), "O que é TCP?");
    await usuario.click(screen.getByRole("button", { name: "Enviar" }));

    expect(screen.getByText("O que é TCP?")).toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.getByText("TCP faz handshake de three-way, segundo Estudos/Redes/TCP.md."),
      ).toBeInTheDocument();
    });
    expect(screen.getByText('Buscou "TCP" — 1 nota(s)')).toBeInTheDocument();
  });

  it("mostra um link para o commit quando o agente escreve uma nota", async () => {
    const usuario = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      mockFetch({
        ok: true,
        corpo: {
          resposta: 'Criei a nota "Estudos/DNS.md".',
          ferramentas: [
            {
              nome: "criar_nota",
              argumentos: { caminho: "Estudos/DNS.md", conteudo: "# DNS" },
              resumo: 'Criou a nota "Estudos/DNS.md"',
              commitUrl: "https://github.com/usuario/vault/commit/abc",
            },
          ],
        },
      }),
    );

    render(<ChatControlado />);

    await usuario.type(screen.getByPlaceholderText("Digite sua mensagem..."), "crie uma nota sobre DNS");
    await usuario.click(screen.getByRole("button", { name: "Enviar" }));

    const link = await screen.findByRole("link", { name: /Criou a nota "Estudos\/DNS\.md"/ });
    expect(link).toHaveAttribute("href", "https://github.com/usuario/vault/commit/abc");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("mostra uma mensagem de erro visível quando a rota falha, sem travar no '...'", async () => {
    const usuario = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      mockFetch({ ok: false, corpo: { erro: "GEMINI_API_KEY não está definida." } }),
    );

    render(<ChatControlado />);

    await usuario.type(screen.getByPlaceholderText("Digite sua mensagem..."), "oi");
    await usuario.click(screen.getByRole("button", { name: "Enviar" }));

    await waitFor(() => {
      expect(screen.getByText("GEMINI_API_KEY não está definida.")).toBeInTheDocument();
    });

    // Não fica travado "pensando" para sempre: o campo (que a própria `enviar`
    // já limpou) aceita texto de novo e o botão reabilita — se `pensando`
    // tivesse ficado `true` por um `finally` que não rodou, isto travaria.
    await usuario.type(screen.getByPlaceholderText("Digite sua mensagem..."), "de novo");
    expect(screen.getByRole("button", { name: "Enviar" })).not.toBeDisabled();
  });

  it("clicar numa sugestão preenche o campo sem enviar a mensagem", async () => {
    const usuario = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn());

    render(<ChatControlado />);

    await usuario.click(
      screen.getByRole("button", { name: "Resuma minhas anotações de redes" }),
    );

    expect(screen.getByPlaceholderText("Digite sua mensagem...")).toHaveValue(
      "Resuma minhas anotações de redes",
    );
    expect(fetch).not.toHaveBeenCalled();
  });
});
