import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PaginaPrincipal from "./PaginaPrincipal";
import { CONFIGURACAO_PADRAO } from "@/lib/fisica-do-grafo";
import type { Grafo } from "@/lib/grafo";
import type { ItemVault } from "@/lib/types";

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
    selecionado?: string | null;
    onSelecionar?: (caminho: string | null) => void;
    focoPedido?: number;
    controleRef?: React.Ref<import("@/components/GrafoDeFundo").ControleDoGrafo>;
  };
  return {
    default: function GrafoFalso({
      interativo,
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
          data-selecionado={selecionado ?? ""}
          data-foco-pedido={focoPedido ?? 0}
        >
          <button type="button" onClick={() => onSelecionar?.("Leituras/Ler.md")}>
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

const ITENS: ItemVault[] = [
  {
    tipo: "pasta",
    nome: "Leituras",
    filhos: [{ tipo: "nota", nome: "Ler", caminho: "Leituras/Ler.md" }],
  },
  {
    tipo: "pasta",
    nome: "Ideias",
    filhos: [{ tipo: "nota", nome: "Atomicas", caminho: "Ideias/Atomicas.md" }],
  },
];

const GRAFO: Grafo = {
  nos: [
    { tipo: "nota", id: "Leituras/Ler.md", titulo: "Ler", grupo: "Leituras" },
    { tipo: "nota", id: "Ideias/Atomicas.md", titulo: "Atomicas", grupo: "Ideias" },
  ],
  arestas: [{ de: "Leituras/Ler.md", para: "Ideias/Atomicas.md" }],
  configuracao: CONFIGURACAO_PADRAO,
};

function renderizar() {
  render(<PaginaPrincipal itens={ITENS} grafo={GRAFO} />);
  return userEvent.setup();
}

const abaNotas = () => screen.getByRole("button", { name: "Notas" });
const abaBimo = () => screen.getByRole("button", { name: "Bimo" });
const campoDoChat = () => screen.getByPlaceholderText("Digite sua mensagem...");
const menuDeNotas = () => screen.getByRole("navigation", { name: "Pastas e notas" });

beforeEach(() => {
  vi.restoreAllMocks();
  Object.values(controle).forEach((funcao) => funcao.mockClear());
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, json: async () => ({ conteudo: "# Ler\n\ntexto da nota" }) }),
  );
});

describe("PaginaPrincipal — seletor Bimo | Notas", () => {
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
    expect(screen.getByTestId("grafo")).toHaveAttribute("data-selecionado", "Leituras/Ler.md");
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
    expect(screen.getByTestId("grafo")).toHaveAttribute("data-selecionado", "Leituras/Ler.md");
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

  it("'Abrir Nota' abre o leitor da nota", async () => {
    const usuario = renderizar();
    await usuario.click(abaNotas());
    await usuario.click(screen.getByRole("button", { name: "clicar no nó Ler" }));

    await usuario.click(screen.getByRole("button", { name: "Abrir Nota" }));

    expect(await screen.findByText("texto da nota")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith("/api/notas/Leituras/Ler.md");
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
  it("clicar numa nota da barra lateral abre o leitor (comportamento de sempre)", async () => {
    const usuario = renderizar();

    await usuario.click(within(menuDeNotas()).getByRole("button", { name: /Ler/ }));

    expect(await screen.findByText("texto da nota")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Nota selecionada" })).not.toBeInTheDocument();
  });
});
