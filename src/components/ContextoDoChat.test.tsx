import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import ContextoDoChat from "./ContextoDoChat";

const notas = [{ id: "1", titulo: "Álgebra", pasta: "Estudos" }, { id: "2", titulo: "Projeto", pasta: null }];
afterEach(() => vi.unstubAllGlobals());
it("seleciona várias notas sem duplicar as atuais e prioriza as abertas", async () => {
  const usuario = userEvent.setup(), aoMudar = vi.fn();
  render(<ContextoDoChat ids={["1"]} notas={notas} abertas={["2"]} ocupado={false} indisponiveis={[]} aoMudar={aoMudar} />);
  await usuario.click(screen.getByRole("button", { name: "+ Adicionar notas" }));
  const dialogo = screen.getByRole("dialog");
  expect(within(dialogo).getAllByRole("checkbox")[0]).not.toBeChecked();
  await usuario.click(within(dialogo).getByRole("checkbox", { name: /Projeto/ }));
  expect(screen.getByText("2 de 10 selecionadas")).toBeInTheDocument();
  await usuario.click(within(dialogo).getByRole("button", { name: "Adicionar" }));
  expect(aoMudar).toHaveBeenCalledWith(["1", "2"]);
});
it("busca por título sem acentos e combina com resultados no conteúdo", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ resultados: [{ id: "3", titulo: "Outra fonte", pasta: "Estudos" }] })));
  const usuario = userEvent.setup();
  render(<ContextoDoChat ids={[]} notas={notas} ocupado={false} indisponiveis={[]} aoMudar={vi.fn()} />);
  await usuario.click(screen.getByRole("button", { name: "+ Adicionar notas" }));
  await usuario.type(screen.getByRole("searchbox"), "algebra");
  expect(screen.getByRole("checkbox", { name: /Álgebra/ })).toBeInTheDocument();
  await screen.findByRole("checkbox", { name: /Outra fonte/ });
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining("q=algebra"), expect.anything());
});
it("remove uma nota, abre por ID e bloqueia alterações durante o pedido", async () => {
  const usuario = userEvent.setup(), aoMudar = vi.fn(), aoAbrir = vi.fn();
  const { rerender } = render(<ContextoDoChat ids={["1"]} notas={notas} ocupado={false} indisponiveis={[]} aoMudar={aoMudar} aoAbrir={aoAbrir} />);
  await usuario.click(screen.getByRole("button", { name: /Álgebra · Estudos/ }));
  expect(aoAbrir).toHaveBeenCalledWith("1");
  await usuario.click(screen.getByRole("button", { name: "Remover Álgebra do contexto" }));
  expect(aoMudar).toHaveBeenCalledWith([]);
  rerender(<ContextoDoChat ids={["1"]} notas={notas} ocupado indisponiveis={["1"]} aoMudar={aoMudar} aoAbrir={aoAbrir} />);
  expect(screen.getByRole("button", { name: "Remover Álgebra do contexto" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "+ Adicionar notas" })).toBeDisabled();
  expect(screen.getByRole("alert")).toHaveTextContent("indisponíveis");
});
it("limita seleção a dez e Escape fecha com foco restaurado", async () => {
  const usuario = userEvent.setup();
  const muitas = Array.from({ length: 11 }, (_, i) => ({ id: String(i), titulo: `Nota ${i}`, pasta: null }));
  render(<ContextoDoChat ids={muitas.slice(0, 10).map((n) => n.id)} notas={muitas} ocupado={false} indisponiveis={[]} aoMudar={vi.fn()} />);
  const botao = screen.getByRole("button", { name: "+ Adicionar notas" });
  await usuario.click(botao);
  expect(screen.getByRole("checkbox", { name: /Nota 10/ })).toBeDisabled();
  await usuario.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(botao).toHaveFocus();
});
