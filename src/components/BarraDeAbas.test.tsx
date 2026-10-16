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
    expect(fechar.closest('[role="tablist"]')).toBeNull();
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


it("mantém apenas abas no tablist, IDs e fechamento na ordem de foco", () => {
  preparar();
  const lista = screen.getByRole("tablist");
  expect(lista.querySelectorAll('button:not([role="tab"])')).toHaveLength(0);
  expect(screen.getByRole("button", { name: "Nova aba" }).closest('[role="tablist"]')).toBeNull();
  expect(screen.getByRole("button", { name: "Fechar Ideias" })).toHaveAttribute("tabindex", "-1");
  expect(screen.getByRole("button", { name: "Fechar Leituras" }).tabIndex).toBe(0);
  for (const chave of ["grafico", "a", "b"]) {
    expect(document.getElementById(`aba-${chave}`)).toHaveAttribute("role", "tab");
  }
});

it("atribui aria-controls somente à selecionada e acompanha a troca de aba", () => {
  const acoes = { aoAtivar: vi.fn(), aoFechar: vi.fn(), aoNovaAba: vi.fn() };
  const { rerender } = render(<BarraDeAbas abas={abas} ativa="a" {...acoes} />);
  for (const ativa of ["a", "b", "grafico"]) {
    rerender(<BarraDeAbas abas={abas} ativa={ativa} {...acoes} />);
    for (const chave of ["grafico", "a", "b"]) {
      const aba = document.getElementById(`aba-${chave}`);
      expect(aba).toHaveAttribute("role", "tab");
      if (chave === ativa) expect(aba).toHaveAttribute("aria-controls", `painel-${chave}`);
      else expect(aba).not.toHaveAttribute("aria-controls");
    }
  }
});

it.each(["Delete", "clique"])("foca a aba ativa após fechar por %s", async (forma) => {
  const acoes = { aoAtivar: vi.fn(), aoFechar: vi.fn(), aoNovaAba: vi.fn() };
  const { rerender } = render(<BarraDeAbas abas={abas} ativa="a" {...acoes} />);
  const usuario = userEvent.setup();
  if (forma === "Delete") {
    screen.getByRole("tab", { name: "Leituras" }).focus();
    await usuario.keyboard("{Delete}");
  } else await usuario.click(screen.getByRole("button", { name: "Fechar Leituras" }));
  rerender(<BarraDeAbas abas={[abas[1]]} ativa="b" {...acoes} />);
  expect(screen.getByRole("tab", { name: "Ideias" })).toHaveFocus();
});
