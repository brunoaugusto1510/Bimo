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

    await usuario.type(screen.getByPlaceholderText("Pergunte, peça uma nota nova ou uma edição…"), "O que é TCP?");
    await usuario.click(screen.getByRole("button", { name: "Enviar" }));

    expect(screen.getByText("O que é TCP?")).toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.getByText("TCP faz handshake de three-way, segundo Estudos/Redes/TCP.md."),
      ).toBeInTheDocument();
    });
    expect(screen.getByText('Buscou "TCP" — 1 nota(s)')).toBeInTheDocument();
  });

  it("mostra uma mensagem de erro visível quando a rota falha, sem travar no '...'", async () => {
    const usuario = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      mockFetch({ ok: false, corpo: { erro: "GEMINI_API_KEY não está definida." } }),
    );

    render(<ChatControlado />);

    await usuario.type(screen.getByPlaceholderText("Pergunte, peça uma nota nova ou uma edição…"), "oi");
    await usuario.click(screen.getByRole("button", { name: "Enviar" }));

    await waitFor(() => {
      expect(screen.getByText("GEMINI_API_KEY não está definida.")).toBeInTheDocument();
    });

    // Não fica travado "pensando" para sempre: o campo (que a própria `enviar`
    // já limpou) aceita texto de novo e o botão reabilita — se `pensando`
    // tivesse ficado `true` por um `finally` que não rodou, isto travaria.
    await usuario.type(screen.getByPlaceholderText("Pergunte, peça uma nota nova ou uma edição…"), "de novo");
    expect(screen.getByRole("button", { name: "Enviar" })).not.toBeDisabled();
  });

  it("clicar numa sugestão preenche o campo sem enviar a mensagem", async () => {
    const usuario = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn());

    render(<ChatControlado />);

    await usuario.click(
      screen.getByRole("button", { name: "Cria uma nota resumindo minhas anotações de redes" }),
    );

    expect(screen.getByPlaceholderText("Pergunte, peça uma nota nova ou uma edição…")).toHaveValue(
      "Cria uma nota resumindo minhas anotações de redes",
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  describe("altura do campo de texto", () => {
    /** O jsdom não faz layout (tudo é 0): o teste dita as medidas que o navegador daria. */
    function medidas({ conteudo, borda }: { conteudo: number; borda: number }) {
      vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(conteudo);
      vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(conteudo + borda);
      vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(conteudo);
    }
    const campo = () => screen.getByPlaceholderText("Pergunte, peça uma nota nova ou uma edição…");

    it("soma a borda ao conteúdo, para o campo não nascer menor que o texto (e com barra de rolagem)", () => {
      medidas({ conteudo: 40, borda: 2 });

      render(<ChatControlado />);

      expect(campo().style.height).toBe("42px");
    });

    it("não mostra barra de rolagem enquanto o texto cabe", () => {
      medidas({ conteudo: 40, borda: 2 });

      render(<ChatControlado />);

      expect(campo().style.overflowY).toBe("hidden");
    });

    it("para de crescer em 160px e só então passa a rolar por dentro", () => {
      medidas({ conteudo: 400, borda: 2 });

      render(<ChatControlado />);

      expect(campo().style.height).toBe("160px");
      expect(campo().style.overflowY).toBe("auto");
    });
  });

  describe("escondido (aba Notas)", () => {
    it("não rola a lista enquanto está escondido, e rola ao voltar a aparecer", () => {
      const rolar = vi.spyOn(Element.prototype, "scrollIntoView");
      const props = { rascunho: "", onRascunhoChange: () => {} };

      const { rerender } = render(<Chat {...props} ativo={false} />);
      expect(rolar).not.toHaveBeenCalled();

      rerender(<Chat {...props} ativo />);

      // `nearest`: só a lista do chat rola, nunca a página.
      expect(rolar).toHaveBeenCalledWith({ behavior: "smooth", block: "nearest" });
    });

    it("não mede o campo enquanto está escondido: o scrollHeight de um elemento sem layout é 0", () => {
      const props = { onRascunhoChange: () => {} };
      const { rerender } = render(<Chat {...props} rascunho="" ativo={false} />);
      const campo = screen.getByPlaceholderText("Pergunte, peça uma nota nova ou uma edição…");

      rerender(<Chat {...props} rascunho="texto escrito com o chat escondido" ativo={false} />);

      // Medir agora fixaria `height: 0px` e o campo sumiria ao voltar.
      expect(campo.style.height).toBe("");
    });
  });
});
