import { act, fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import ControlesDaEdicao from "./ControlesDaEdicao";
it("oferece as três saídas do conflito e as escolhas de recuperação", async () => {
  const resolver = vi.fn().mockResolvedValue(undefined);
  const { rerender } = render(<ControlesDaEdicao conflito recuperado={false} resolver={resolver} />);
  for (const [nome, escolha] of [["Manter minha versão (substitui a salva)", "manter"], ["Usar a versão salva (descarta a minha)", "usar"], ["Copiar minha versão", "copiar"]]) {
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: nome })); }); expect(resolver).toHaveBeenCalledWith(escolha);
  }
  rerender(<ControlesDaEdicao conflito={false} recuperado resolver={resolver} />);
  expect(screen.getByRole("group", { name: "Recuperação de rascunho" })).toHaveTextContent("Decida sobre o rascunho antes de editar");
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Restaurar rascunho" })); }); expect(resolver).toHaveBeenCalledWith("restaurar");
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Descartar rascunho" })); }); expect(resolver).toHaveBeenCalledWith("descartar");
});
it("copiar mantém grupo aberto, anuncia sucesso e falha devolve foco ao botão", async () => {
  const resolver = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("negado"));
  render(<ControlesDaEdicao conflito recuperado={false} resolver={resolver} />);
  const copiar = screen.getByRole("button", { name: "Copiar minha versão" });
  await act(async () => fireEvent.click(copiar));
  expect(screen.getByRole("group", { name: "Conflito de edição" })).toBeInTheDocument();
  expect(screen.getByText("Sua versão foi copiada")).toBeInTheDocument();
  await act(async () => fireEvent.click(copiar)); expect(copiar).toHaveFocus(); expect(copiar).not.toBeDisabled();
});
