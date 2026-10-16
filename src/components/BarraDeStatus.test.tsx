import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import BarraDeStatus from "./BarraDeStatus";
describe("BarraDeStatus", () => {
  it("anuncia status e reserva contagens para telas maiores", () => {
    render(<BarraDeStatus itens={["7 conexões", "142 palavras"]} mensagem="Salvo agora" />);
    expect(screen.getByRole("contentinfo")).toHaveClass("min-h-8", "h-auto", "tabular-nums");
    expect(screen.getByRole("status")).toHaveTextContent("Salvo agora");
    expect(screen.getByText("7 conexões").closest(".hidden")).toHaveClass("md:flex");
  });
  it("aceita mensagem ausente e atualiza status", () => {
    const { rerender } = render(<BarraDeStatus itens={[]} />);
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    rerender(<BarraDeStatus itens={[]} mensagem="Somente leitura" />);
    expect(screen.getByRole("status")).toHaveTextContent("Somente leitura");
  });
});
