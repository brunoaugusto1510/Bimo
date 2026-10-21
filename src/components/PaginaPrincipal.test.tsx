import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PaginaPrincipal from "./PaginaPrincipal";
import { CONFIGURACAO_PADRAO } from "@/lib/fisica-do-grafo";
import type { Grafo } from "@/lib/grafo-de-notas";
import type { ItemDeNotas } from "@/lib/types";

const controle = vi.hoisted(() => ({
  aproximar: vi.fn(),
  afastar: vi.fn(),
  enquadrar: vi.fn(),
  enquadrarVizinhos: vi.fn(),
}));

/**
 * O jsdom não tem canvas, então o grafo de verdade não roda aqui. Este
 * substituto expõe o que a página repassa a ele (modo, seleção) e deixa o teste
 * "clicar num nó" — a lógica de gestos e câmera é coberta nos testes de
 * `camera-do-grafo`.
 */
vi.mock("@/components/GrafoDeFundo", async () => {
  const { useImperativeHandle } = await import("react");
  type Props = {
    interativo?: boolean;
    pausado?: boolean;
    selecionado?: string | null;
    onSelecionar?: (id: string | null) => void;
    focoPedido?: number;
    controleRef?: React.Ref<import("@/components/GrafoDeFundo").ControleDoGrafo>;
  };
  return {
    default: function GrafoFalso({
      interativo,
      pausado,
      selecionado,
      onSelecionar,
      focoPedido,
      controleRef,
    }: Props) {
      useImperativeHandle(controleRef, () => controle, []);
      return (
        <div
          data-testid="grafo"
          data-interativo={String(Boolean(interativo))}
          data-pausado={String(Boolean(pausado))}
          data-selecionado={selecionado ?? ""}
          data-foco-pedido={focoPedido ?? 0}
        >
          <button type="button" onClick={() => onSelecionar?.("10")}>
            clicar no nó Ler
          </button>
          <button type="button" onClick={() => onSelecionar?.(null)}>
            clicar no vazio
          </button>
        </div>
      );
    },
  };
});

const ITENS: ItemDeNotas[] = [
  {
    tipo: "pasta",
    nome: "Leituras",
    caminho: "Leituras",
    filhos: [{ tipo: "nota", id: "10", nome: "Ler", pasta: "Leituras" }],
  },
  {
    tipo: "pasta",
    nome: "Ideias",
    caminho: "Ideias",
    filhos: [{ tipo: "nota", id: "11", nome: "Atomicas", pasta: "Ideias" }],
  },
];

const GRAFO: Grafo = {
  nos: [
    { tipo: "nota", id: "10", titulo: "Ler", grupo: "Leituras" },
    { tipo: "nota", id: "11", titulo: "Atomicas", grupo: "Ideias" },
  ],
  arestas: [{ de: "10", para: "11" }],
  configuracao: CONFIGURACAO_PADRAO,
};

function renderizar() {
  render(<PaginaPrincipal itens={ITENS} grafo={GRAFO} />);
  return userEvent.setup();
}
it("falha na atualização por API conserva conversa e grafo montados", async () => {
  const usuario = renderizar();
  await usuario.type(campoDoChat(), "Pergunta persistente"); await usuario.click(screen.getByRole("button", { name: "Enviar" }));
  await screen.findByText("Pergunta persistente");
  const conversa = screen.getByText("Pergunta persistente"); const grafo = screen.getByTestId("grafo");
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("rede")));
  await act(async () => { window.dispatchEvent(new Event("bimo:nota-salva")); });
  expect(screen.getByText("Pergunta persistente")).toBe(conversa); expect(screen.getByTestId("grafo")).toBe(grafo);
  expect(await screen.findByText(/Os dados anteriores continuam na tela/)).toBeInTheDocument();
});

const abaNotas = () => screen.getByRole("button", { name: "Notas" });
const abaBimo = () => screen.getByRole("button", { name: "Bimo" });
const campoDoChat = () => screen.getByPlaceholderText("Pergunte, peça uma nota nova ou uma edição…");
const menuDeNotas = () => screen.getByRole("navigation", { name: "Pastas e notas" });

beforeEach(() => {
  vi.restoreAllMocks();
  Object.values(controle).forEach((funcao) => funcao.mockClear());
  localStorage.clear();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => ({
      ok: true,
      status: 200,
      json: async () =>
        url.endsWith("/ligacoes")
          ? { ligacoes: { saida: [], entrada: [] }, mencoesSemLigacao: [] }
          : {
              nota: {
                id: "10",
                titulo: "Ler",
                pasta: "Leituras",
                tags: [],
                conteudo: "# Ler\n\ntexto da nota",
                criadoEm: null,
                atualizadoEm: null,
                revisao: 1,
              },
              capacidades: { escrita: false, datas: false },
            },
    })),
  );
});

describe("PaginaPrincipal — seletor Bimo | Notas", () => {
  it("mesclar novos dados do servidor preserva o chat e a instância do grafo", async () => {
    const usuario = userEvent.setup();
    const { rerender } = render(<PaginaPrincipal itens={ITENS} grafo={GRAFO} />);
    const campo = campoDoChat(); const grafo = screen.getByTestId("grafo");
    await usuario.type(campo, "conversa preservada");
    rerender(<PaginaPrincipal itens={[...ITENS]} grafo={{ ...GRAFO, nos: [...GRAFO.nos], arestas: [...GRAFO.arestas] }} />);
    expect(campoDoChat()).toBe(campo); expect(campoDoChat()).toHaveValue("conversa preservada");
    expect(screen.getByTestId("grafo")).toBe(grafo);
  });
  it("começa na aba Bimo: chat à mostra, grafo só de fundo e sem barra do grafo", () => {
    renderizar();

    expect(abaBimo()).toHaveAttribute("aria-pressed", "true");
    expect(abaNotas()).toHaveAttribute("aria-pressed", "false");
    expect(campoDoChat()).toBeVisible();
    expect(screen.getByTestId("grafo")).toHaveAttribute("data-interativo", "false");
    expect(screen.queryByRole("button", { name: "Enquadrar o grafo" })).not.toBeInTheDocument();
  });

  it("ao clicar em Notas, o grafo vira interativo e mostra a barra com as contagens", async () => {
    const usuario = renderizar();

    await usuario.click(abaNotas());

    expect(abaNotas()).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("grafo")).toHaveAttribute("data-interativo", "true");
    expect(screen.getByText("2 nós · 1 conexão")).toBeInTheDocument();
  });

  it("esconde o chat na aba Notas, mas o mantém montado — a conversa não se perde", async () => {
    const usuario = renderizar();
    await usuario.type(campoDoChat(), "rascunho em andamento");

    await usuario.click(abaNotas());
    expect(campoDoChat()).not.toBeVisible();

    await usuario.click(abaBimo());
    expect(campoDoChat()).toBeVisible();
    expect(campoDoChat()).toHaveValue("rascunho em andamento");
  });

  it("volta o grafo ao modo fundo ao retornar para Bimo", async () => {
    const usuario = renderizar();

    await usuario.click(abaNotas());
    await usuario.click(abaBimo());

    expect(screen.getByTestId("grafo")).toHaveAttribute("data-interativo", "false");
    expect(screen.queryByRole("button", { name: "Enquadrar o grafo" })).not.toBeInTheDocument();
  });
});

describe("PaginaPrincipal — aba Notas", () => {
  it("selecionar um nó mostra o cartão de foco com pasta e conexões", async () => {
    const usuario = renderizar();
    await usuario.click(abaNotas());

    await usuario.click(screen.getByRole("button", { name: "clicar no nó Ler" }));

    const cartao = screen.getByRole("region", { name: "Nota selecionada" });
    expect(within(cartao).getByText("Ler")).toBeInTheDocument();
    expect(within(cartao).getByText("Leituras · 1 conexão")).toBeInTheDocument();
    expect(screen.getByTestId("grafo")).toHaveAttribute("data-selecionado", "10");
  });

  it("não mostra cartão nenhum enquanto nada está selecionado", async () => {
    const usuario = renderizar();

    await usuario.click(abaNotas());

    expect(screen.queryByRole("region", { name: "Nota selecionada" })).not.toBeInTheDocument();
  });

  it("clicar no vazio do grafo ou no ✕ fecha o cartão", async () => {
    const usuario = renderizar();
    await usuario.click(abaNotas());

    await usuario.click(screen.getByRole("button", { name: "clicar no nó Ler" }));
    await usuario.click(screen.getByRole("button", { name: "clicar no vazio" }));
    expect(screen.queryByRole("region", { name: "Nota selecionada" })).not.toBeInTheDocument();

    await usuario.click(screen.getByRole("button", { name: "clicar no nó Ler" }));
    await usuario.click(screen.getByRole("button", { name: "Fechar" }));
    expect(screen.queryByRole("region", { name: "Nota selecionada" })).not.toBeInTheDocument();
  });

  it("clicar numa nota da barra lateral a seleciona no grafo, sem abrir o leitor", async () => {
    const usuario = renderizar();
    await usuario.click(abaNotas());

    await usuario.click(within(menuDeNotas()).getByRole("button", { name: /Ler/ }));

    expect(screen.getByRole("region", { name: "Nota selecionada" })).toBeInTheDocument();
    expect(screen.getByTestId("grafo")).toHaveAttribute("data-selecionado", "10");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("escolher na barra lateral pede o foco da câmera, inclusive para a nota que já estava selecionada", async () => {
    const usuario = renderizar();
    await usuario.click(abaNotas());
    const notaNoMenu = () => within(menuDeNotas()).getByRole("button", { name: /Ler/ });

    await usuario.click(notaNoMenu());
    expect(screen.getByTestId("grafo")).toHaveAttribute("data-foco-pedido", "1");

    // Mesma nota de novo (o usuário arrastou o grafo para longe e quer reencontrá-la):
    // `selecionado` não muda, mas o pedido de foco sim.
    await usuario.click(notaNoMenu());
    expect(screen.getByTestId("grafo")).toHaveAttribute("data-foco-pedido", "2");
  });

  it("selecionar clicando no próprio grafo não pede foco: a nota já está sob o dedo", async () => {
    const usuario = renderizar();
    await usuario.click(abaNotas());

    await usuario.click(screen.getByRole("button", { name: "clicar no nó Ler" }));

    expect(screen.getByTestId("grafo")).toHaveAttribute("data-foco-pedido", "0");
  });

  it("'Abrir Nota' abre a nota numa aba e deixa o grafo em pausa por baixo", async () => {
    const usuario = renderizar();
    await usuario.click(abaNotas());
    await usuario.click(screen.getByRole("button", { name: "clicar no nó Ler" }));

    await usuario.click(screen.getByRole("button", { name: "Abrir Nota" }));

    expect(await screen.findByText("texto da nota")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith("/api/notas/10", expect.anything());
    expect(screen.getByRole("tab", { name: "Ler" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("grafo")).toHaveAttribute("data-pausado", "true");
    expect(screen.queryByRole("region", { name: "Nota selecionada" })).not.toBeInTheDocument();
  });

  it("a aba Gráfico volta ao grafo vivo, com a barra do grafo, sem fechar a nota", async () => {
    const usuario = renderizar();
    await usuario.click(abaNotas());
    await usuario.click(screen.getByRole("button", { name: "clicar no nó Ler" }));
    await usuario.click(screen.getByRole("button", { name: "Abrir Nota" }));

    await usuario.click(screen.getByRole("tab", { name: /Gráfico/ }));

    expect(screen.getByTestId("grafo")).toHaveAttribute("data-pausado", "false");
    expect(screen.getByRole("button", { name: "Enquadrar o grafo" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Ler" })).toBeInTheDocument();
  });

  it("'Perguntar ao Bimo' volta para o chat com a pergunta já escrita", async () => {
    const usuario = renderizar();
    await usuario.click(abaNotas());
    await usuario.click(screen.getByRole("button", { name: "clicar no nó Ler" }));

    await usuario.click(screen.getByRole("button", { name: "Perguntar ao Bimo" }));

    expect(abaBimo()).toHaveAttribute("aria-pressed", "true");
    expect(campoDoChat()).toBeVisible();
    expect(campoDoChat()).toHaveValue('O que eu anotei em "Ler"?');
  });

  it("'Ver vizinhos' pede à câmera para enquadrar a nota e as ligadas a ela", async () => {
    const usuario = renderizar();
    await usuario.click(abaNotas());
    await usuario.click(screen.getByRole("button", { name: "clicar no nó Ler" }));

    await usuario.click(screen.getByRole("button", { name: "Ver vizinhos" }));

    expect(controle.enquadrarVizinhos).toHaveBeenCalledOnce();
  });

  it.each([
    ["Aproximar", "aproximar"],
    ["Afastar", "afastar"],
    ["Enquadrar o grafo", "enquadrar"],
  ] as const)("o botão %s aciona a câmera (%s)", async (nome, comando) => {
    const usuario = renderizar();
    await usuario.click(abaNotas());

    await usuario.click(screen.getByRole("button", { name: nome }));

    expect(controle[comando]).toHaveBeenCalledOnce();
  });
});

describe("PaginaPrincipal — aba Bimo", () => {
  it("clicar numa nota da barra lateral leva ao modo Notas e abre a nota numa aba", async () => {
    const usuario = renderizar();

    await usuario.click(within(menuDeNotas()).getByRole("button", { name: /Ler/ }));

    expect(await screen.findByText("texto da nota")).toBeInTheDocument();
    expect(abaNotas()).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("tab", { name: "Ler" })).toHaveAttribute("aria-selected", "true");
  });
});

describe("PaginaPrincipal — abas e paleta", () => {
  it("clicar noutra nota da barra lateral, estando numa aba de nota, navega dentro da mesma aba", async () => {
    const usuario = renderizar();
    await usuario.click(within(menuDeNotas()).getByRole("button", { name: /Ler/ }));
    await screen.findByText("texto da nota");

    await usuario.click(within(menuDeNotas()).getByRole("button", { name: /Atomicas/ }));

    // O Gráfico e uma aba só, agora com a outra nota.
    expect(screen.getAllByRole("tab")).toHaveLength(2);
    expect(screen.getByRole("tab", { name: "Atomicas" })).toHaveAttribute("aria-selected", "true");
  });

  it("Ctrl+O abre a paleta 'Ir para nota', mesmo no modo Bimo, e escolher uma nota abre a aba", async () => {
    const usuario = renderizar();

    await usuario.keyboard("{Control>}o{/Control}");
    const paleta = await screen.findByRole("dialog", { name: "Ir para nota" });
    await usuario.click(within(paleta).getByRole("option", { name: /Ler/ }));

    expect(screen.queryByRole("dialog", { name: "Ir para nota" })).not.toBeInTheDocument();
    expect(abaNotas()).toHaveAttribute("aria-pressed", "true");
    expect(await screen.findByText("texto da nota")).toBeInTheDocument();
  });

  it("Esc fecha a paleta sem abrir nada", async () => {
    const usuario = renderizar();
    await usuario.keyboard("{Control>}o{/Control}");
    await screen.findByRole("dialog", { name: "Ir para nota" });

    await usuario.keyboard("{Escape}");

    expect(screen.queryByRole("dialog", { name: "Ir para nota" })).not.toBeInTheDocument();
    expect(abaBimo()).toHaveAttribute("aria-pressed", "true");
  });

  it("Ctrl+G vai para o Gráfico no modo Notas e Ctrl+J volta ao Bimo", async () => {
    const usuario = renderizar();

    await usuario.keyboard("{Control>}g{/Control}");
    expect(abaNotas()).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("tab", { name: /Gráfico/ })).toHaveAttribute("aria-selected", "true");

    await usuario.keyboard("{Control>}j{/Control}");
    expect(abaBimo()).toHaveAttribute("aria-pressed", "true");
  });

  it("Ctrl+G e Ctrl+J fecham o menu de notas do celular em vez de deixar o destino escondido", async () => {
    const usuario = renderizar();

    await usuario.click(screen.getByRole("button", { name: "Mostrar ou esconder as notas" }));
    expect(screen.getByTestId("grafo").closest(".hidden")).not.toBeNull();

    await usuario.keyboard("{Control>}g{/Control}");

    expect(screen.getByTestId("grafo").closest(".hidden")).toBeNull();
  });

  it("com a paleta aberta, os outros atalhos ficam parados: o diálogo é modal", async () => {
    const usuario = renderizar();
    await usuario.keyboard("{Control>}o{/Control}");
    await screen.findByRole("dialog", { name: "Ir para nota" });

    await usuario.keyboard("{Control>}g{/Control}");
    await usuario.keyboard("{Control>}j{/Control}");

    expect(screen.getByRole("dialog", { name: "Ir para nota" })).toBeInTheDocument();
    expect(abaBimo()).toHaveAttribute("aria-pressed", "true");
    expect(abaNotas()).toHaveAttribute("aria-pressed", "false");
  });

  it("'Perguntar ao Bimo' não apaga o que a pessoa já tinha digitado no chat", async () => {
    const usuario = renderizar();
    await usuario.type(campoDoChat(), "uma ideia pela metade");
    await usuario.click(within(menuDeNotas()).getByRole("button", { name: /Ler/ }));
    await screen.findByText("texto da nota");

    await usuario.click(screen.getByRole("button", { name: "Mais opções" }));
    await usuario.click(screen.getByRole("menuitem", { name: "Perguntar ao Bimo" }));

    expect(campoDoChat()).toHaveValue('uma ideia pela metade\nO que eu anotei em "Ler"?');
  });

  it("a área de conteúdo é o landmark principal da página", () => {
    renderizar();

    expect(screen.getByRole("main")).toBeInTheDocument();
  });

  it("'Perguntar ao Bimo' numa nota aberta leva ao chat com a pergunta escrita", async () => {
    const usuario = renderizar();
    await usuario.click(within(menuDeNotas()).getByRole("button", { name: /Ler/ }));
    await screen.findByText("texto da nota");

    await usuario.click(screen.getByRole("button", { name: "Mais opções" }));
    await usuario.click(screen.getByRole("menuitem", { name: "Perguntar ao Bimo" }));

    expect(abaBimo()).toHaveAttribute("aria-pressed", "true");
    expect(campoDoChat()).toHaveValue('O que eu anotei em "Ler"?');
  });

  it("as abas abertas voltam quando a página é recarregada", async () => {
    const usuario = renderizar();
    await usuario.click(within(menuDeNotas()).getByRole("button", { name: /Ler/ }));
    await screen.findByText("texto da nota");

    cleanup();
    renderizar();
    await usuario.click(abaNotas());

    expect(await screen.findByRole("tab", { name: "Ler" })).toBeInTheDocument();
  });
});
