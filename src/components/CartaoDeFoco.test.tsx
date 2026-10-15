import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import CartaoDeFoco from "./CartaoDeFoco";

function renderizar(props: Partial<React.ComponentProps<typeof CartaoDeFoco>> = {}) {
  const acoes = {
    onAbrir: vi.fn(),
    onVizinhos: vi.fn(),
    onPerguntar: vi.fn(),
    onFechar: vi.fn(),
  };
  render(
    <CartaoDeFoco titulo="Ler é uma conversa" pasta="Leituras" conexoes={7} {...acoes} {...props} />,
  );
  return acoes;
}

describe("CartaoDeFoco", () => {
  it("mostra o título da nota e a meta com pasta e conexões", () => {
    renderizar();

    expect(screen.getByText("Ler é uma conversa")).toBeInTheDocument();
    expect(screen.getByText("Leituras · 7 conexões")).toBeInTheDocument();
  });

  it("usa o singular com uma conexão só", () => {
    renderizar({ conexoes: 1 });

    expect(screen.getByText("Leituras · 1 conexão")).toBeInTheDocument();
  });

  it("diz que a nota não tem conexões quando está isolada", () => {
    renderizar({ conexoes: 0 });

    expect(screen.getByText("Leituras · sem conexões")).toBeInTheDocument();
  });

  it.each([
    ["Abrir Nota", "onAbrir"],
    ["Ver vizinhos", "onVizinhos"],
    ["Perguntar ao Bimo", "onPerguntar"],
    ["Fechar", "onFechar"],
  ] as const)("o botão %s dispara %s", async (nome, acao) => {
    const acoes = renderizar();

    await userEvent.setup().click(screen.getByRole("button", { name: nome }));

    expect(acoes[acao]).toHaveBeenCalledOnce();
  });
});
