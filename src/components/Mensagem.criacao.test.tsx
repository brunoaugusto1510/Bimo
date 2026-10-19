import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import Mensagem from "./Mensagem";
it("pílula abre nota por id e mantém link de commit separado", () => {
 const abrir = vi.fn();
 render(<Mensagem aoAbrirNota={abrir} mensagem={{ id: "m", papel: "agente", conteudo: "Pronto", ferramentas: [{ nome: "criar_nota", argumentos: { caminho: "P/Nova.md" }, resumo: "Criou Nova", notaId: "42", commitUrl: "https://example.com/commit" }] }} />);
 fireEvent.click(screen.getByRole("button", { name: "Criou Nova. Abrir nota" }));
 expect(abrir).toHaveBeenCalledWith("42", { titulo: "Nova", pasta: "P" });
 expect(screen.getByRole("link", { name: /commit/i })).toHaveAttribute("href", "https://example.com/commit");
});
it("não inventa resumo quando a ferramenta não informa caminho", () => {
 const abrir = vi.fn();
 render(<Mensagem aoAbrirNota={abrir} mensagem={{ id: "m", papel: "agente", conteudo: "Pronto", ferramentas: [{ nome: "criar_nota", argumentos: {}, resumo: "Criou nota", notaId: "42" }] }} />);
 fireEvent.click(screen.getByRole("button", { name: /Criou nota/ }));
 expect(abrir).toHaveBeenCalledWith("42", undefined);
});
