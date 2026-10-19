import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import TelaInicial from "./TelaInicial";
function propriedades() {
  return { recentes: [{ id: "a", titulo: "Leituras", pasta: "Ideias", conexoes: 7 }], criarDisponivel: true, aoCriar: vi.fn(), aoIrParaNota: vi.fn(), aoAbrirGrafico: vi.fn(), aoPerguntarAoBimo: vi.fn(), aoAbrirNota: vi.fn() };
}
describe("TelaInicial", () => {
  it("apresenta ações, atalhos e recentes", async () => {
    const props = propriedades();
    render(<TelaInicial {...props} />);
    const usuario = userEvent.setup();
    expect(screen.getByRole("heading", { name: "Abra uma nota para começar" })).toHaveClass("text-balance");
    expect(screen.getByText("Alt N").tagName).toBe("KBD");
    for (const nome of ["Criar nova nota", "Ir para nota", "Abrir o gráfico", "Perguntar ao Bimo"]) await usuario.click(screen.getByRole("button", { name: new RegExp(nome) }));
    for (const acao of [props.aoCriar, props.aoIrParaNota, props.aoAbrirGrafico, props.aoPerguntarAoBimo]) expect(acao).toHaveBeenCalledOnce();
    await usuario.click(screen.getByRole("button", { name: /Leituras/ }));
    expect(props.aoAbrirNota).toHaveBeenCalledWith("a");
    expect(screen.getByRole("region", { name: "Notas recentes" })).toHaveTextContent("Ideias");
  });
  it("explica criação indisponível e lista vazia", async () => {
    const props = propriedades();
    render(<TelaInicial {...props} recentes={[]} criarDisponivel={false} />);
    const criar = screen.getByRole("button", { name: /Criar nova nota/ });
    expect(criar).toHaveAttribute("aria-disabled", "true");
    expect(criar).toHaveAccessibleDescription(expect.stringContaining("somente leitura"));
    await userEvent.setup().click(criar);
    expect(props.aoCriar).toHaveBeenCalledOnce();
    expect(screen.getByText("Nenhuma nota aberta ainda.")).toBeInTheDocument();
  });
});
