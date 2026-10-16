import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import BarraDeNavegacao from "./BarraDeNavegacao";
function preparar(edicaoDisponivel = true) {
  const acoes = { aoVoltar: vi.fn(), aoAvancar: vi.fn(), aoAlternarModo: vi.fn(), aoCopiarLigacao: vi.fn(), aoAbrirEmNovaAba: vi.fn(), aoPerguntarAoBimo: vi.fn() };
  render(<BarraDeNavegacao pasta="Leituras" titulo="Uma ideia" podeVoltar podeAvancar={false} modo="leitura" edicaoDisponivel={edicaoDisponivel} {...acoes} />);
  return acoes;
}
describe("BarraDeNavegacao", () => {
  it("apresenta histórico, caminho e alternância controlada", async () => {
    const acoes = preparar();
    const usuario = userEvent.setup();
    expect(screen.getByRole("navigation", { name: "Caminho da nota" })).toHaveTextContent("Leituras / Uma ideia");
    expect(screen.getByRole("button", { name: "Avançar" })).toHaveAttribute("aria-disabled", "true");
    await usuario.click(screen.getByRole("button", { name: "Voltar" }));
    await usuario.click(screen.getByRole("button", { name: "Edição" }));
    expect(acoes.aoVoltar).toHaveBeenCalledOnce();
    expect(acoes.aoAlternarModo).toHaveBeenCalledOnce();
  });
  it("explica edição indisponível e não alterna", async () => {
    const acoes = preparar(false);
    const botao = screen.getByRole("button", { name: "Edição" });
    await userEvent.setup().click(botao);
    expect(acoes.aoAlternarModo).not.toHaveBeenCalled();
    expect(botao).toHaveAttribute("aria-disabled", "true");
    expect(botao).toHaveAccessibleDescription("A edição ainda não está disponível: as notas estão em modo somente leitura.");
  });
  it("fecha menu com Esc e devolve foco", async () => {
    preparar();
    const usuario = userEvent.setup();
    const botao = screen.getByRole("button", { name: "Mais opções" });
    await usuario.click(botao);
    expect(botao).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("menuitem", { name: "Abrir em nova aba" })).toHaveFocus();
    await usuario.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(botao).toHaveFocus();
  });
  it.each(["Abrir em nova aba", "Copiar ligação", "Perguntar ao Bimo"])("executa %s e fecha", async (rotulo) => {
    const acoes = preparar();
    const usuario = userEvent.setup();
    await usuario.click(screen.getByRole("button", { name: "Mais opções" }));
    await usuario.click(screen.getByRole("menuitem", { name: rotulo }));
    const acao = rotulo === "Copiar ligação" ? acoes.aoCopiarLigacao : rotulo === "Abrir em nova aba" ? acoes.aoAbrirEmNovaAba : acoes.aoPerguntarAoBimo;
    expect(acao).toHaveBeenCalledOnce();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mais opções" })).toHaveFocus();
  });
});

it("preserva foco no histórico indisponível e ignora clique", async () => {
  const acoes = preparar();
  const avancar = screen.getByRole("button", { name: "Avançar" });
  expect(avancar).not.toBeDisabled();
  await userEvent.setup().click(avancar);
  expect(avancar).toHaveFocus();
  expect(acoes.aoAvancar).not.toHaveBeenCalled();
});
