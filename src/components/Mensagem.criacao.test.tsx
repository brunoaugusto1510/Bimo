import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import Mensagem from "./Mensagem";
it("abre a nota escrita por id, sem link de commit (as notas não vivem mais no GitHub)", () => {
 const abrir = vi.fn();
 render(<Mensagem aoAbrirNota={abrir} mensagem={{ id: "m", papel: "agente", conteudo: "Pronto", ferramentas: [{ nome: "criar_nota", argumentos: { caminho: "P/Nova.md" }, resumo: "Criou Nova", notaId: "42" }] }} />);
 fireEvent.click(screen.getByRole("button", { name: "Abrir Nova" }));
 expect(abrir).toHaveBeenCalledWith("42", { titulo: "Nova", pasta: "P" });
 expect(screen.getByText("P/Nova.md")).toBeInTheDocument();
 expect(screen.queryByRole("link", { name: /commit/i })).toBeNull();
});
it("a resposta do agente nunca cria uma <img>: imagem vira texto alternativo (sem pedido de rede)", () => {
 const { container } = render(<Mensagem aoAbrirNota={vi.fn()} mensagem={{ id: "m", papel: "agente", conteudo: "veja ![logo](https://x.exemplo/?d=segredo) e ![](https://x.exemplo/b.png)" }} />);
 // (A marca do Bimo ao lado da resposta é uma <img> própria: a conferência é pelas imagens que vieram do texto.)
 expect(container.querySelector("img[src*='exemplo']")).toBeNull();
 expect(container.querySelectorAll("img[alt='logo'], img[alt='']:not([aria-hidden])")).toHaveLength(0);
 expect(screen.getByText("[imagem: logo]")).toBeInTheDocument();
});
it("não inventa título quando a ferramenta não informa caminho", () => {
 const abrir = vi.fn();
 render(<Mensagem aoAbrirNota={abrir} mensagem={{ id: "m", papel: "agente", conteudo: "Pronto", ferramentas: [{ nome: "criar_nota", argumentos: {}, resumo: "Criou nota", notaId: "42" }] }} />);
 fireEvent.click(screen.getByRole("button", { name: "Abrir nota" }));
 expect(abrir).toHaveBeenCalledWith("42", undefined);
});
it("mostra os passos do agente como pílulas, inclusive os que deram erro", () => {
 render(<Mensagem mensagem={{ id: "m", papel: "agente", conteudo: "Pronto", ferramentas: [
  { nome: "buscar_notas", argumentos: {}, resumo: 'Buscou "tcp" — 2 nota(s)' },
  { nome: "ler_nota", argumentos: {}, resumo: "Não achei a nota", erro: true },
 ] }} />);
 const passos = within(screen.getByRole("list", { name: "O que o Bimo fez" })).getAllByRole("listitem");
 expect(passos.map((passo) => passo.textContent)).toEqual(['Buscou "tcp" — 2 nota(s)', "Não achei a nota"]);
});
it("as fontes acendem a nota no cérebro; a nota escrita não se repete nelas", () => {
 const mostrar = vi.fn();
 render(<Mensagem aoAbrirNota={vi.fn()} aoMostrarNoCerebro={mostrar} mensagem={{
  id: "m", papel: "agente", conteudo: "Pronto",
  ferramentas: [{ nome: "editar_nota", argumentos: { caminho: "Redes/TCP" }, resumo: "Editou TCP", notaId: "a" }],
  fontes: [{ id: "a", titulo: "TCP" }, { id: "b", titulo: "Handshake" }],
 }} />);
 expect(screen.queryByRole("button", { name: "TCP, mostrar no cérebro" })).toBeNull();
 fireEvent.click(screen.getByRole("button", { name: "Handshake, mostrar no cérebro" }));
 expect(mostrar).toHaveBeenCalledWith("b");
 expect(screen.getByRole("button", { name: "Abrir TCP" })).toBeInTheDocument();
});
