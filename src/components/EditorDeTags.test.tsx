import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import EditorDeTags from "./EditorDeTags";

const base = { daColuna: ["ideia", "projeto"], noTexto: ["rascunho"], sugestoes: ["ideia", "estudo", "rascunho", "viagem"], ocupado: false };
const campoDeTag = () => screen.getByRole("combobox", { name: "Adicionar tag" });

it("mostra as tags da coluna com botão de remover e as do texto marcadas, sem remover", () => {
  render(<EditorDeTags {...base} aoMudar={vi.fn()} />);
  expect(screen.getByRole("button", { name: "Remover tag ideia" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Remover tag projeto" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Remover tag rascunho" })).not.toBeInTheDocument();
  const doTexto = screen.getByText("#rascunho").closest("li");
  expect(doTexto).toHaveTextContent("no texto"); expect(doTexto).toHaveTextContent("para remover, edite o texto da nota");
});
it("sugere só as tags que a nota ainda não tem", () => {
  const { container } = render(<EditorDeTags {...base} aoMudar={vi.fn()} />);
  expect([...container.querySelectorAll("datalist option")].map((o) => o.getAttribute("value"))).toEqual(["estudo", "viagem"]);
});
it("Enter adiciona a tag digitada (sem #) e anuncia", async () => {
  const mudar = vi.fn().mockResolvedValue({});
  render(<EditorDeTags {...base} aoMudar={mudar} />);
  fireEvent.change(campoDeTag(), { target: { value: "#Estudo " } }); fireEvent.keyDown(campoDeTag(), { key: "Enter" });
  await waitFor(() => expect(mudar).toHaveBeenCalledWith(["ideia", "projeto", "Estudo"]));
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Tag «Estudo» adicionada"));
  expect(campoDeTag()).toHaveValue("");
});
it("vírgula também adiciona, e uma lista colada vira várias tags de uma vez", async () => {
  const mudar = vi.fn().mockResolvedValue({});
  render(<EditorDeTags {...base} aoMudar={mudar} />);
  fireEvent.change(campoDeTag(), { target: { value: "viagem" } }); fireEvent.keyDown(campoDeTag(), { key: ",", code: "Comma" });
  await waitFor(() => expect(mudar).toHaveBeenCalledWith(["ideia", "projeto", "viagem"]));
  mudar.mockClear();
  fireEvent.change(campoDeTag(), { target: { value: "a, #b ,c" } }); fireEvent.keyDown(campoDeTag(), { key: "Enter" });
  await waitFor(() => expect(mudar).toHaveBeenCalledWith(["ideia", "projeto", "a", "b", "c"]));
});
it("tag repetida não chama e explica", () => {
  const mudar = vi.fn();
  render(<EditorDeTags {...base} aoMudar={mudar} />);
  fireEvent.change(campoDeTag(), { target: { value: "IDEIA" } }); fireEvent.keyDown(campoDeTag(), { key: "Enter" });
  expect(mudar).not.toHaveBeenCalled(); expect(screen.getByRole("alert")).toHaveTextContent("A nota já tem a tag «ideia».");
});
it("tag com espaço não é aceita (no texto ela viraria só a primeira palavra)", () => {
  const mudar = vi.fn();
  render(<EditorDeTags {...base} aoMudar={mudar} />);
  fireEvent.change(campoDeTag(), { target: { value: "meu projeto" } }); fireEvent.keyDown(campoDeTag(), { key: "Enter" });
  expect(mudar).not.toHaveBeenCalled(); expect(screen.getByRole("alert")).toHaveTextContent("Tags não podem ter espaços");
});
it("respeita os limites do servidor antes de enviar", () => {
  const mudar = vi.fn();
  const muitas = Array.from({ length: 30 }, (_, i) => `t${i}`);
  const { rerender } = render(<EditorDeTags {...base} daColuna={muitas} aoMudar={mudar} />);
  fireEvent.change(campoDeTag(), { target: { value: "extra" } }); fireEvent.keyDown(campoDeTag(), { key: "Enter" });
  expect(screen.getByRole("alert")).toHaveTextContent("Use no máximo 30 tags.");
  rerender(<EditorDeTags {...base} aoMudar={mudar} />);
  fireEvent.change(campoDeTag(), { target: { value: "x".repeat(101) } }); fireEvent.keyDown(campoDeTag(), { key: "Enter" });
  expect(screen.getByRole("alert")).toHaveTextContent("no máximo 100 caracteres"); expect(mudar).not.toHaveBeenCalled();
});
it("Enter com o campo vazio não faz nada", () => {
  const mudar = vi.fn();
  render(<EditorDeTags {...base} aoMudar={mudar} />);
  fireEvent.keyDown(campoDeTag(), { key: "Enter" });
  expect(mudar).not.toHaveBeenCalled();
});
it("remover chama sem a tag, anuncia e leva o foco ao botão do chip vizinho", async () => {
  const mudar = vi.fn().mockResolvedValue({});
  const { rerender } = render(<EditorDeTags {...base} aoMudar={mudar} />);
  fireEvent.click(screen.getByRole("button", { name: "Remover tag ideia" }));
  await waitFor(() => expect(mudar).toHaveBeenCalledWith(["projeto"]));
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Tag «ideia» removida"));
  rerender(<EditorDeTags {...base} daColuna={["projeto"]} aoMudar={mudar} />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Remover tag projeto" })).toHaveFocus());
});
it("remover a última tag leva o foco ao campo", async () => {
  const mudar = vi.fn().mockResolvedValue({});
  const { rerender } = render(<EditorDeTags {...base} daColuna={["so"]} aoMudar={mudar} />);
  fireEvent.click(screen.getByRole("button", { name: "Remover tag so" }));
  await waitFor(() => expect(mudar).toHaveBeenCalledWith([]));
  rerender(<EditorDeTags {...base} daColuna={[]} aoMudar={mudar} />);
  await waitFor(() => expect(campoDeTag()).toHaveFocus());
});
it("falha ao remover não move o foco e mostra o motivo", async () => {
  const mudar = vi.fn().mockRejectedValue(new Error("rede"));
  render(<EditorDeTags {...base} aoMudar={mudar} />);
  const botao = screen.getByRole("button", { name: "Remover tag ideia" }); botao.focus();
  fireEvent.click(botao);
  expect(await screen.findByRole("alert")).toHaveTextContent("rede"); expect(botao).toHaveFocus();
});
it("mostra a recusa do servidor e mantém o que foi digitado", async () => {
  const mudar = vi.fn().mockRejectedValue(new Error("Use no máximo 30 tags."));
  render(<EditorDeTags {...base} aoMudar={mudar} />);
  fireEvent.change(campoDeTag(), { target: { value: "nova" } }); fireEvent.keyDown(campoDeTag(), { key: "Enter" });
  expect(await screen.findByRole("alert")).toHaveTextContent("Use no máximo 30 tags.");
  expect(campoDeTag()).toHaveValue("nova");
});
it("ocupado: campo somente leitura, remover desativado e aviso de espera", () => {
  const mudar = vi.fn();
  render(<EditorDeTags {...base} ocupado aoMudar={mudar} />);
  expect(campoDeTag()).toHaveAttribute("readonly");
  fireEvent.keyDown(campoDeTag(), { key: "Enter" });
  expect(screen.getByRole("status")).toHaveTextContent("Aguarde a atualização terminar");
  const remover = screen.getByRole("button", { name: "Remover tag ideia" });
  expect(remover).toHaveAttribute("aria-disabled", "true"); fireEvent.click(remover);
  expect(mudar).not.toHaveBeenCalled();
});
it("sem tags mostra o estado vazio", () => {
  render(<EditorDeTags daColuna={[]} noTexto={[]} sugestoes={[]} ocupado={false} aoMudar={vi.fn()} />);
  expect(screen.getByText("Sem tags")).toBeInTheDocument();
});
