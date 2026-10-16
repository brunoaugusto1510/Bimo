import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import PropriedadesDaNota from "./PropriedadesDaNota";
describe("PropriedadesDaNota", () => {
  it("mostra tags, raiz, datas locais e zero conexões; recolhe", async () => {
    render(<PropriedadesDaNota tags={["leitura"]} pasta={null} criadoEm="2026-10-15T18:03:00" atualizadoEm="2026-10-16T09:41:00" conexoes={0} agora={new Date("2026-10-16T12:00:00")} />);
    expect(screen.getByText("#leitura")).toHaveClass("bg-destaque-suave");
    expect(screen.getByText("Raiz")).toBeInTheDocument();
    expect(screen.getByText("ontem, 18:03")).toBeInTheDocument();
    expect(screen.getByText("hoje, 09:41")).toBeInTheDocument();
    expect(screen.getByText(/◈ 0/)).toHaveClass("tabular-nums");
    const botao = screen.getByRole("button", { name: "Propriedades" });
    expect(botao).toHaveAttribute("aria-expanded", "true");
    await userEvent.setup().click(botao);
    expect(botao).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Raiz")).not.toBeInTheDocument();
  });
  it("omite dados desconhecidos e formata outros dias em pt-BR", () => {
    const { rerender } = render(<PropriedadesDaNota tags={[]} pasta="Ideias" criadoEm="2026-03-12T12:00:00" atualizadoEm={null} conexoes={null} agora={new Date("2026-10-16T12:00:00")} />);
    expect(screen.getByText("12 de março")).toBeInTheDocument();
    expect(screen.queryByText("Editada")).not.toBeInTheDocument();
    expect(screen.queryByText("Conexões")).not.toBeInTheDocument();
    rerender(<PropriedadesDaNota tags={[]} pasta={null} criadoEm={null} atualizadoEm={null} conexoes={null} />);
    expect(screen.queryByText("Criada")).not.toBeInTheDocument();
  });
});
