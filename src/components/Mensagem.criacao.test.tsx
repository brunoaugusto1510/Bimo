import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import Mensagem from "./Mensagem";
it("pílula abre nota por id, sem link de commit (as notas não vivem mais no GitHub)", () => {
 const abrir = vi.fn();
 render(<Mensagem aoAbrirNota={abrir} mensagem={{ id: "m", papel: "agente", conteudo: "Pronto", ferramentas: [{ nome: "criar_nota", argumentos: { caminho: "P/Nova.md" }, resumo: "Criou Nova", notaId: "42" }] }} />);
 fireEvent.click(screen.getByRole("button", { name: "Criou Nova. Abrir nota" }));
 expect(abrir).toHaveBeenCalledWith("42", { titulo: "Nova", pasta: "P" });
 expect(screen.queryByRole("link", { name: /commit/i })).toBeNull();
});
it("a resposta do agente nunca cria uma <img>: imagem vira texto alternativo (sem pedido de rede)", () => {
 const { container } = render(<Mensagem aoAbrirNota={vi.fn()} mensagem={{ id: "m", papel: "agente", conteudo: "veja ![logo](https://x.exemplo/?d=segredo) e ![](https://x.exemplo/b.png)" }} />);
 // (O logo do Bimo na assinatura é uma <img> própria: a conferência é pelas imagens que vieram do texto.)
 expect(container.querySelector("img[src*='exemplo']")).toBeNull();
 expect(container.querySelectorAll("img[alt='logo'], img[alt='']:not([aria-hidden])")).toHaveLength(0);
 expect(screen.getByText("[imagem: logo]")).toBeInTheDocument();
});
it("não inventa resumo quando a ferramenta não informa caminho", () => {
 const abrir = vi.fn();
 render(<Mensagem aoAbrirNota={abrir} mensagem={{ id: "m", papel: "agente", conteudo: "Pronto", ferramentas: [{ nome: "criar_nota", argumentos: {}, resumo: "Criou nota", notaId: "42" }] }} />);
 fireEvent.click(screen.getByRole("button", { name: /Criou nota/ }));
 expect(abrir).toHaveBeenCalledWith("42", undefined);
});
