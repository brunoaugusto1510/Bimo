import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import SugestoesDoEditor from "./SugestoesDoEditor";

const sugestoes = [
  { id: "1", titulo: "Receitas", pasta: "Cozinha", alvo: "Receitas", intervalos: [[0, 3]] as [number, number][] },
  { id: "2", titulo: "Reunião", pasta: null, alvo: "Reunião", intervalos: [] },
];
const posicao = { topo: 120, esquerda: 40 };

it("mostra uma lista de opções com a pasta e marca a ativa", () => {
  render(<SugestoesDoEditor id="lista" sugestoes={sugestoes} indiceAtivo={1} posicao={posicao} aoEscolher={vi.fn()} />);
  expect(screen.getByRole("listbox", { name: "Notas para ligar" })).toHaveAttribute("id", "lista");
  const opcoes = screen.getAllByRole("option");
  expect(opcoes).toHaveLength(2);
  expect(opcoes[0]).toHaveAttribute("id", "lista-1"); expect(opcoes[0]).toHaveAttribute("aria-selected", "false");
  expect(opcoes[1]).toHaveAttribute("aria-selected", "true");
  expect(opcoes[0]).toHaveTextContent("Receitas"); expect(opcoes[0]).toHaveTextContent("Cozinha");
});
it("destaca o trecho que casou sem mudar o texto lido", () => {
  render(<SugestoesDoEditor id="lista" sugestoes={sugestoes} indiceAtivo={0} posicao={posicao} aoEscolher={vi.fn()} />);
  const marcado = screen.getAllByRole("option")[0].querySelector("[data-casou]");
  expect(marcado).toHaveTextContent("Rec");
  expect(screen.getAllByRole("option")[0]).toHaveAccessibleName("Receitas, na pasta Cozinha");
  expect(screen.getAllByRole("option")[1]).toHaveAccessibleName("Reunião");
});
it("o mousedown é cancelado em toda a lista (o foco fica no editor) e quem escolhe é o click", () => {
  const escolher = vi.fn();
  render(<SugestoesDoEditor id="lista" sugestoes={sugestoes} indiceAtivo={0} posicao={posicao} aoEscolher={escolher} />);
  const pressionar = (alvo: Element) => { const evento = new MouseEvent("mousedown", { bubbles: true, cancelable: true }); alvo.dispatchEvent(evento); return evento.defaultPrevented; };
  expect(pressionar(screen.getAllByRole("option")[1])).toBe(true);
  expect(pressionar(screen.getByRole("listbox"))).toBe(true);
  expect(escolher).not.toHaveBeenCalled();
  fireEvent.click(screen.getAllByRole("option")[1]);
  expect(escolher).toHaveBeenCalledWith(1);
});
it("posiciona abaixo do cursor, ou acima quando falta espaço", () => {
  const { rerender } = render(<SugestoesDoEditor id="lista" sugestoes={sugestoes} indiceAtivo={0} posicao={{ topo: 120, esquerda: 40 }} aoEscolher={vi.fn()} />);
  expect(screen.getByRole("listbox")).toHaveStyle({ top: "120px" });
  rerender(<SugestoesDoEditor id="lista" sugestoes={sugestoes} indiceAtivo={0} posicao={{ base: 300, esquerda: 40 }} aoEscolher={vi.fn()} />);
  expect(screen.getByRole("listbox")).toHaveStyle({ bottom: "300px" });
});
it("rola só a lista (não a página) para manter a opção ativa à vista", () => {
  const rolarPagina = vi.fn(); window.HTMLElement.prototype.scrollIntoView = rolarPagina;
  const { rerender } = render(<SugestoesDoEditor id="lista" sugestoes={sugestoes} indiceAtivo={0} posicao={posicao} aoEscolher={vi.fn()} />);
  const lista = screen.getByRole("listbox"), opcoes = screen.getAllByRole("option");
  Object.defineProperty(lista, "clientHeight", { configurable: true, value: 50 });
  opcoes.forEach((opcao, i) => { Object.defineProperty(opcao, "offsetTop", { configurable: true, value: i * 40 }); Object.defineProperty(opcao, "offsetHeight", { configurable: true, value: 40 }); });
  rerender(<SugestoesDoEditor id="lista" sugestoes={sugestoes} indiceAtivo={1} posicao={posicao} aoEscolher={vi.fn()} />);
  expect(lista.scrollTop).toBe(30);
  rerender(<SugestoesDoEditor id="lista" sugestoes={sugestoes} indiceAtivo={0} posicao={posicao} aoEscolher={vi.fn()} />);
  expect(lista.scrollTop).toBe(0); expect(rolarPagina).not.toHaveBeenCalled();
  delete (window.HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView;
});
