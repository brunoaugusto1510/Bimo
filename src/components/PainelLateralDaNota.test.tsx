import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import PainelLateralDaNota from "./PainelLateralDaNota";
function propriedades() {
  return { estado: "pronto" as const, sugestao: { id: "s", titulo: "Leituras" }, entradas: [{ id: "e", titulo: "Origem", pasta: null, trecho: "Uma citação" }], saidas: [{ tipo: "nota" as const, id: "d", titulo: "Destino", pasta: null, ambigua: false }, { tipo: "nao-resolvida" as const, alvo: "Futura", titulo: "Futura" }], estrutura: [{ nivel: 2, texto: "O hábito", linha: 8 }], podeInserir: true, aoAbrirNota: vi.fn(), aoIrParaLinha: vi.fn(), aoInserirSugestao: vi.fn(), aoDescartarSugestao: vi.fn(), aoPerguntarAoBimo: vi.fn() };
}
describe("PainelLateralDaNota", () => {
  it("apresenta sugestão, ligações e estrutura com ações", async () => {
    const props = propriedades();
    render(<PainelLateralDaNota {...props} />);
    const usuario = userEvent.setup();
    expect(screen.getByRole("complementary", { name: "Painel lateral" })).toBeInTheDocument();
    expect(screen.getByText("Você cita “Leituras” no texto sem ligar a essa nota.")).toBeInTheDocument();
    expect(screen.getByText("Uma citação")).toBeInTheDocument();
    expect(screen.getByText(/ainda não existe/)).toBeInTheDocument();
    await usuario.click(screen.getByRole("button", { name: /Origem/ }));
    await usuario.click(screen.getByRole("button", { name: /Destino/ }));
    expect(props.aoAbrirNota.mock.calls).toEqual([["e"], ["d"]]);
    await usuario.click(screen.getByRole("button", { name: "O hábito" }));
    expect(props.aoIrParaLinha).toHaveBeenCalledWith(8);
    await usuario.click(screen.getByRole("button", { name: "+ Inserir" }));
    await usuario.click(screen.getByRole("button", { name: "Descartar" }));
    expect(props.aoInserirSugestao).toHaveBeenCalledOnce();
    expect(props.aoDescartarSugestao).toHaveBeenCalledOnce();
  });
  it("desabilita inserção e oferece pergunta sem sugestão", async () => {
    const props = propriedades();
    const { rerender } = render(<PainelLateralDaNota {...props} podeInserir={false} />);
    expect(screen.getByRole("button", { name: "+ Inserir" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "+ Inserir" })).toHaveAttribute("title", expect.stringContaining("modo somente leitura"));
    rerender(<PainelLateralDaNota {...props} sugestao={null} entradas={[]} saidas={[]} estrutura={[]} />);
    expect(screen.getByText("Nenhuma nota liga a esta ainda.")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Perguntar ao Bimo" }));
    expect(props.aoPerguntarAoBimo).toHaveBeenCalledOnce();
  });
  it("distingue carregamento e falha", () => {
    const props = propriedades();
    const { rerender } = render(<PainelLateralDaNota {...props} estado="carregando" />);
    expect(within(screen.getByRole("region", { name: "Sugestão do Bimo" })).getByRole("status")).toBeInTheDocument();
    rerender(<PainelLateralDaNota {...props} estado="erro" />);
    expect(screen.getByText("Não consegui carregar as ligações.")).toBeInTheDocument();
  });
});
