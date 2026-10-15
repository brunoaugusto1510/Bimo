import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import BarraDoGrafo from "./BarraDoGrafo";

function renderizar(props: Partial<React.ComponentProps<typeof BarraDoGrafo>> = {}) {
  const acoes = { onAproximar: vi.fn(), onAfastar: vi.fn(), onEnquadrar: vi.fn() };
  render(<BarraDoGrafo nos={642} conexoes={1284} {...acoes} {...props} />);
  return acoes;
}

describe("BarraDoGrafo", () => {
  it("mostra as contagens com separador de milhar em português", () => {
    renderizar();

    expect(screen.getByText("642 nós · 1.284 conexões")).toBeInTheDocument();
  });

  it("usa o singular quando há um nó e uma conexão", () => {
    renderizar({ nos: 1, conexoes: 1 });

    expect(screen.getByText("1 nó · 1 conexão")).toBeInTheDocument();
  });

  it.each([
    ["Aproximar", "onAproximar"],
    ["Afastar", "onAfastar"],
    ["Enquadrar o grafo", "onEnquadrar"],
  ] as const)("o botão %s dispara %s", async (nome, acao) => {
    const acoes = renderizar();

    await userEvent.setup().click(screen.getByRole("button", { name: nome }));

    expect(acoes[acao]).toHaveBeenCalledOnce();
  });
});
