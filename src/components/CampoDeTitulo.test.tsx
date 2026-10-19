import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import CampoDeTitulo from "./CampoDeTitulo";
it("bloqueia digitação durante o pedido e informa pendência ao contêiner", async () => {
 const pendente = vi.fn();
 const confirmar = vi.fn(() => new Promise(() => {}));
 render(<CampoDeTitulo titulo="Original" aoConfirmar={confirmar} aoTexto={() => {}} aoMudarPendencia={pendente} />);
 const campo = screen.getByRole("textbox");
 fireEvent.change(campo, { target: { value: "Novo" } }); fireEvent.blur(campo);
 expect(campo).toHaveAttribute("readonly");
 expect(pendente).toHaveBeenLastCalledWith(true);
});
it("sincroniza título externo sem apagar a digitação focada", () => {
 const props = { aoConfirmar: vi.fn(), aoTexto: vi.fn() };
 const { rerender } = render(<CampoDeTitulo titulo="Original" {...props} />);
 rerender(<CampoDeTitulo titulo="Externo" {...props} />);
 const campo = screen.getByRole("textbox"); expect(campo).toHaveValue("Externo");
 fireEvent.focus(campo); fireEvent.change(campo, { target: { value: "Local" } });
 rerender(<CampoDeTitulo titulo="Outro" {...props} />);
 expect(campo).toHaveValue("Local");
 expect(campo).toHaveAccessibleDescription("Enter confirma e vai ao texto. Esc desfaz.");
});
it("ao sair do foco adota título externo se a pessoa não digitou", () => {
 const confirmar = vi.fn();
 const { rerender } = render(<CampoDeTitulo titulo="Original" aoConfirmar={confirmar} aoTexto={vi.fn()} />);
 const campo = screen.getByRole("textbox"); fireEvent.focus(campo);
 rerender(<CampoDeTitulo titulo="Externo" aoConfirmar={confirmar} aoTexto={vi.fn()} />);
 fireEvent.blur(campo);
 expect(campo).toHaveValue("Externo"); expect(confirmar).not.toHaveBeenCalled();
});
it("foca e seleciona; Enter confirma e pede foco no texto", async () => {
 const confirmar = vi.fn().mockResolvedValue(undefined), texto = vi.fn();
 render(<CampoDeTitulo titulo="Sem título" focar aoConfirmar={confirmar} aoTexto={texto} />);
 const campo = screen.getByRole("textbox", { name: "Título da nota" }) as HTMLInputElement;
 expect(campo).toHaveFocus(); expect([campo.selectionStart, campo.selectionEnd]).toEqual([0, 10]);
 fireEvent.change(campo, { target: { value: "Novo" } }); fireEvent.keyDown(campo, { key: "Enter" });
 await waitFor(() => expect(texto).toHaveBeenCalled()); expect(confirmar).toHaveBeenCalledWith("Novo");
});
it("falha preserva texto e explica; Escape desfaz sem confirmar no blur", async () => {
 const confirmar = vi.fn().mockRejectedValue(new Error("Em uso"));
 render(<CampoDeTitulo titulo="Original" aoConfirmar={confirmar} aoTexto={() => {}} />);
 const campo = screen.getByRole("textbox", { name: "Título da nota" });
 fireEvent.change(campo, { target: { value: "Repetido" } }); fireEvent.blur(campo);
 expect(await screen.findByRole("alert")).toHaveTextContent("Em uso"); expect(campo).toHaveValue("Repetido"); expect(campo).toHaveAttribute("aria-invalid", "true");
 fireEvent.keyDown(campo, { key: "Escape" }); fireEvent.blur(campo);
 expect(campo).toHaveValue("Original"); expect(confirmar).toHaveBeenCalledTimes(1);
});
