import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import BarraDeAbas from "./BarraDeAbas";
const abas = [{ chave: "a", titulo: "Leituras" }, { chave: "b", titulo: "Ideias" }];
function preparar(ativa = "a") {
  const acoes = { aoAtivar: vi.fn(), aoFechar: vi.fn(), aoNovaAba: vi.fn() };
  render(<BarraDeAbas abas={abas} ativa={ativa} {...acoes} />);
  return acoes;
}
describe("BarraDeAbas", () => {
  it("expõe abas, controles e fechamento como irmão", async () => {
    const acoes = preparar();
    expect(screen.getByRole("tablist", { name: "Abas abertas" })).toBeInTheDocument();
    const aba = screen.getByRole("tab", { name: "Leituras" });
    expect(aba).toHaveAttribute("aria-selected", "true");
    expect(aba).toHaveAttribute("aria-controls");
    const fechar = screen.getByRole("button", { name: "Fechar Leituras" });
    expect(fechar.parentElement).toBe(aba.parentElement);
    expect(screen.queryByLabelText("Fechar Gráfico")).not.toBeInTheDocument();
    await userEvent.setup().click(fechar);
    expect(acoes.aoFechar).toHaveBeenCalledWith("a");
    await userEvent.setup().click(screen.getByRole("button", { name: "Nova aba" }));
    expect(acoes.aoNovaAba).toHaveBeenCalledOnce();
  });
  it("navega circularmente, ativa e preserva o gráfico ao fechar", async () => {
    const acoes = preparar("grafico");
    const usuario = userEvent.setup();
    expect(screen.getAllByRole("tab").map((aba) => aba.tabIndex)).toEqual([0, -1, -1]);
    screen.getByRole("tab", { name: "Gráfico" }).focus();
    await usuario.keyboard("{ArrowLeft}");
    expect(screen.getByRole("tab", { name: "Ideias" })).toHaveFocus();
    expect(acoes.aoAtivar).toHaveBeenLastCalledWith("b");
    await usuario.keyboard("{Delete}{Home}{Delete}{ArrowRight}{End}");
    expect(acoes.aoFechar).toHaveBeenCalledExactlyOnceWith("b");
    expect(screen.getByRole("tab", { name: "Ideias" })).toHaveFocus();
    fireEvent(screen.getByRole("tab", { name: "Leituras" }), new MouseEvent("auxclick", { button: 1, bubbles: true }));
    fireEvent(screen.getByRole("tab", { name: "Gráfico" }), new MouseEvent("auxclick", { button: 1, bubbles: true }));
    expect(acoes.aoFechar.mock.calls).toEqual([["b"], ["a"]]);
  });
});

