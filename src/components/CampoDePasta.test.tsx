import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import CampoDePasta from "./CampoDePasta";

const pastas = ["Projetos", "Projetos/Bimo", "Ideias"];
const campoDePasta = () => screen.getByRole("combobox", { name: "Pasta" });
const mover = () => screen.getByRole("button", { name: "Mover" });

it("mostra a pasta atual (Raiz quando não há) e oferece as existentes", () => {
  const { rerender, container } = render(<CampoDePasta pasta="Projetos" pastas={pastas} ocupado={false} aoMudar={vi.fn()} />);
  expect(campoDePasta()).toHaveValue("Projetos");
  expect([...container.querySelectorAll("datalist option")].map((o) => o.getAttribute("value"))).toEqual(["Raiz", ...pastas]);
  rerender(<CampoDePasta pasta={null} pastas={pastas} ocupado={false} aoMudar={vi.fn()} />);
  expect(campoDePasta()).toHaveValue("Raiz");
});
it("Enter confirma a pasta digitada e mostra, de forma visível, a contagem de notas reescritas", async () => {
  const mudar = vi.fn().mockResolvedValue({ notasReescritas: 2, pasta: "Ideias/Novas" });
  render(<CampoDePasta pasta={null} pastas={pastas} ocupado={false} aoMudar={mudar} />);
  campoDePasta().focus(); fireEvent.change(campoDePasta(), { target: { value: " Ideias/Novas " } }); fireEvent.keyDown(campoDePasta(), { key: "Enter" });
  await waitFor(() => expect(mudar).toHaveBeenCalledWith("Ideias/Novas"));
  const aviso = await screen.findByText("Pasta alterada para «Ideias/Novas»; 2 notas tiveram ligações atualizadas");
  expect(aviso.closest("[role=status]")).not.toHaveClass("sr-only");
});
it("o botão Mover confirma, e fica desativado enquanto não há o que mover", async () => {
  const mudar = vi.fn().mockResolvedValue({});
  render(<CampoDePasta pasta="Projetos" pastas={pastas} ocupado={false} aoMudar={mudar} />);
  expect(mover()).toHaveAttribute("aria-disabled", "true"); fireEvent.click(mover()); expect(mudar).not.toHaveBeenCalled();
  fireEvent.change(campoDePasta(), { target: { value: "Ideias" } });
  expect(mover()).not.toHaveAttribute("aria-disabled");
  fireEvent.click(mover());
  await waitFor(() => expect(mudar).toHaveBeenCalledWith("Ideias"));
});
it("Raiz, vazio e / levam a nota à raiz", async () => {
  const mudar = vi.fn().mockResolvedValue({ pasta: null });
  render(<CampoDePasta pasta="Projetos" pastas={pastas} ocupado={false} aoMudar={mudar} />);
  campoDePasta().focus(); fireEvent.change(campoDePasta(), { target: { value: "Raiz" } }); fireEvent.keyDown(campoDePasta(), { key: "Enter" });
  await waitFor(() => expect(mudar).toHaveBeenCalledWith(null));
  expect(await screen.findByText("Pasta alterada para a raiz")).toBeInTheDocument();
});
it("uma pasta real chamada Raiz não é confundida com a raiz", async () => {
  const mudar = vi.fn().mockResolvedValue({});
  const { container } = render(<CampoDePasta pasta={null} pastas={["Raiz", "Outra"]} ocupado={false} aoMudar={mudar} />);
  expect([...container.querySelectorAll("datalist option")].map((o) => o.getAttribute("value"))).toEqual(["Raiz", "Outra"]);
  campoDePasta().focus(); fireEvent.change(campoDePasta(), { target: { value: "Raiz" } }); fireEvent.keyDown(campoDePasta(), { key: "Enter" });
  await waitFor(() => expect(mudar).toHaveBeenCalledWith("Raiz"));
});
it("depois de mover, mostra a pasta que o servidor gravou (outra grafia)", async () => {
  const mudar = vi.fn().mockResolvedValue({ pasta: "Projetos" });
  render(<CampoDePasta pasta={null} pastas={pastas} ocupado={false} aoMudar={mudar} />);
  campoDePasta().focus(); fireEvent.change(campoDePasta(), { target: { value: "projetos" } }); fireEvent.keyDown(campoDePasta(), { key: "Enter" });
  await waitFor(() => expect(campoDePasta()).toHaveValue("Projetos"));
  expect(screen.getByText("Pasta alterada para «Projetos»")).toBeInTheDocument();
});
it("não chama quando a pasta não mudou", () => {
  const mudar = vi.fn();
  render(<CampoDePasta pasta="Projetos" pastas={pastas} ocupado={false} aoMudar={mudar} />);
  campoDePasta().focus(); fireEvent.change(campoDePasta(), { target: { value: "Projetos " } }); fireEvent.keyDown(campoDePasta(), { key: "Enter" });
  expect(mudar).not.toHaveBeenCalled(); expect(campoDePasta()).toHaveValue("Projetos");
});
it("sair do campo mantém o que foi digitado (o botão Mover continua ao lado)", () => {
  const mudar = vi.fn();
  render(<CampoDePasta pasta="Projetos" pastas={pastas} ocupado={false} aoMudar={mudar} />);
  campoDePasta().focus(); fireEvent.change(campoDePasta(), { target: { value: "Outra" } }); fireEvent.blur(campoDePasta());
  expect(campoDePasta()).toHaveValue("Outra"); expect(mudar).not.toHaveBeenCalled();
});
it("Esc descarta o digitado e avisa; sem digitação não avisa", () => {
  render(<CampoDePasta pasta="Projetos" pastas={pastas} ocupado={false} aoMudar={vi.fn()} />);
  fireEvent.keyDown(campoDePasta(), { key: "Escape" });
  expect(screen.getByRole("status").textContent).toBe("");
  fireEvent.change(campoDePasta(), { target: { value: "Outra" } }); fireEvent.keyDown(campoDePasta(), { key: "Escape" });
  expect(campoDePasta()).toHaveValue("Projetos"); expect(screen.getByRole("status")).toHaveTextContent("Alteração da pasta descartada");
});
it("ao focar, seleciona o texto para a lista mostrar todas as pastas", () => {
  render(<CampoDePasta pasta="Projetos" pastas={pastas} ocupado={false} aoMudar={vi.fn()} />);
  const campo = campoDePasta() as HTMLInputElement; campo.focus();
  expect([campo.selectionStart, campo.selectionEnd]).toEqual([0, 8]);
});
it("mudança externa não apaga o que a pessoa está digitando", () => {
  const props = { pastas, ocupado: false, aoMudar: vi.fn() };
  const { rerender } = render(<CampoDePasta pasta="Projetos" {...props} />);
  campoDePasta().focus(); fireEvent.change(campoDePasta(), { target: { value: "Rascunho" } });
  rerender(<CampoDePasta pasta="Ideias" {...props} />);
  expect(campoDePasta()).toHaveValue("Rascunho");
});
it("mostra o motivo da recusa e mantém o texto digitado", async () => {
  const mudar = vi.fn().mockRejectedValue(new Error("Já existe «Nota» nessa pasta."));
  render(<CampoDePasta pasta={null} pastas={pastas} ocupado={false} aoMudar={mudar} />);
  campoDePasta().focus(); fireEvent.change(campoDePasta(), { target: { value: "Ideias" } }); fireEvent.keyDown(campoDePasta(), { key: "Enter" });
  expect(await screen.findByRole("alert")).toHaveTextContent("Já existe «Nota» nessa pasta.");
  expect(campoDePasta()).toHaveValue("Ideias"); expect(campoDePasta()).toHaveAttribute("aria-invalid", "true");
});
it("durante outra operação fica somente leitura e avisa que é preciso esperar", () => {
  const mudar = vi.fn();
  render(<CampoDePasta pasta={null} pastas={pastas} ocupado aoMudar={mudar} />);
  expect(campoDePasta()).toHaveAttribute("readonly"); expect(campoDePasta()).toHaveAttribute("aria-busy", "true");
  fireEvent.keyDown(campoDePasta(), { key: "Enter" });
  expect(mudar).not.toHaveBeenCalled(); expect(screen.getByRole("status")).toHaveTextContent("Aguarde a atualização terminar");
});
