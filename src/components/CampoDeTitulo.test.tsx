import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import CampoDeTitulo from "./CampoDeTitulo";
it("bloqueia digitação durante o pedido e informa pendência ao contêiner", async () => {
 const pendente = vi.fn();
 const confirmar = vi.fn(() => new Promise<void>(() => {}));
 render(<CampoDeTitulo titulo="Original" confirmarAoSair aoConfirmar={confirmar} aoTexto={() => {}} aoMudarPendencia={pendente} />);
 const campo = screen.getByRole("textbox");
 campo.focus(); fireEvent.change(campo, { target: { value: "Novo" } }); fireEvent.blur(campo);
 expect(campo).toHaveAttribute("readonly"); expect(campo).not.toHaveAttribute("aria-readonly");
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
 expect(campo).toHaveAccessibleDescription("Enter confirma e vai ao texto. Esc desfaz. Ao sair sem confirmar, o título volta ao anterior.");
});
it("ao sair do foco adota título externo se a pessoa não digitou", () => {
 const confirmar = vi.fn();
 const { rerender } = render(<CampoDeTitulo titulo="Original" aoConfirmar={confirmar} aoTexto={vi.fn()} />);
 const campo = screen.getByRole("textbox"); campo.focus();
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
 campo.focus(); fireEvent.change(campo, { target: { value: "Repetido" } }); fireEvent.keyDown(campo, { key: "Enter" });
 expect(await screen.findByRole("alert")).toHaveTextContent("Em uso"); expect(campo).toHaveValue("Repetido"); expect(campo).toHaveAttribute("aria-invalid", "true");
 fireEvent.keyDown(campo, { key: "Escape" }); fireEvent.blur(campo);
 expect(campo).toHaveValue("Original"); expect(confirmar).toHaveBeenCalledTimes(1);
});

it("blur em nota existente restaura o título atual e limpa pendência sem confirmar", () => {
 const confirmar = vi.fn(), pendencia = vi.fn();
 const { rerender } = render(<CampoDeTitulo titulo="Original" aoConfirmar={confirmar} aoTexto={vi.fn()} aoMudarPendencia={pendencia} />);
 const campo = screen.getByRole("textbox"); campo.focus();
 fireEvent.change(campo, { target: { value: "Local" } });
 expect(pendencia).toHaveBeenLastCalledWith(true);
 rerender(<CampoDeTitulo titulo="Externo" aoConfirmar={confirmar} aoTexto={vi.fn()} aoMudarPendencia={pendencia} />);
 fireEvent.blur(campo);
 expect(confirmar).not.toHaveBeenCalled(); expect(campo).toHaveValue("Externo");
 expect(pendencia).toHaveBeenLastCalledWith(false);
});
it("confirmarAoSair confirma o título de nota recém-criada", async () => {
 const confirmar = vi.fn().mockResolvedValue(undefined);
 render(<CampoDeTitulo titulo="Original" confirmarAoSair aoConfirmar={confirmar} aoTexto={vi.fn()} />);
 const campo = screen.getByRole("textbox"); campo.focus();
 fireEvent.change(campo, { target: { value: "Novo" } }); fireEvent.blur(campo);
 await waitFor(() => expect(confirmar).toHaveBeenCalledWith("Novo"));
});
it.each([undefined, 0, 1, 2])("anuncia ligações atualizadas: %s", async (notasReescritas) => {
 render(<CampoDeTitulo titulo="Original" aoConfirmar={vi.fn().mockResolvedValue({ notasReescritas })} aoTexto={vi.fn()} />);
 const campo = screen.getByRole("textbox");
 fireEvent.change(campo, { target: { value: "Novo" } }); fireEvent.keyDown(campo, { key: "Enter" });
 const sufixo = notasReescritas === 1 ? "; 1 nota teve a ligação atualizada" : notasReescritas ? `; ${notasReescritas} notas tiveram ligações atualizadas` : "";
 await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(`Título alterado para «Novo»${sufixo}`));
});
it("blur causado por perder a janela não restaura o título digitado", () => {
 const confirmar = vi.fn();
 render(<CampoDeTitulo titulo="Original" aoConfirmar={confirmar} aoTexto={vi.fn()} />);
 const campo = screen.getByRole("textbox"); campo.focus();
 fireEvent.change(campo, { target: { value: "Digitado" } });
 const janela = vi.spyOn(document, "hasFocus").mockReturnValue(false);
 fireEvent.blur(campo);
 expect(campo).toHaveValue("Digitado"); expect(confirmar).not.toHaveBeenCalled();
 janela.mockRestore();
});
it("blur que descarta texto digitado em nota existente anuncia que o título foi mantido", () => {
 render(<CampoDeTitulo titulo="Original" aoConfirmar={vi.fn()} aoTexto={vi.fn()} />);
 const campo = screen.getByRole("textbox"); campo.focus();
 fireEvent.change(campo, { target: { value: "Digitado" } }); fireEvent.blur(campo);
 expect(campo).toHaveValue("Original");
 expect(screen.getByRole("status")).toHaveTextContent("Título não confirmado; mantido «Original»");
});
it("blur sem digitação não anuncia nada", () => {
 render(<CampoDeTitulo titulo="Original" aoConfirmar={vi.fn()} aoTexto={vi.fn()} />);
 const campo = screen.getByRole("textbox"); campo.focus(); fireEvent.blur(campo);
 expect(screen.getByRole("status").textContent).toBe("");
});
it("título que só difere por espaços limpa a pendência e volta ao título atual", () => {
 const pendencia = vi.fn(), texto = vi.fn();
 render(<CampoDeTitulo titulo="Original" aoConfirmar={vi.fn()} aoTexto={texto} aoMudarPendencia={pendencia} />);
 const campo = screen.getByRole("textbox");
 fireEvent.change(campo, { target: { value: "Original  " } });
 expect(pendencia).toHaveBeenLastCalledWith(true);
 fireEvent.keyDown(campo, { key: "Enter" });
 expect(pendencia).toHaveBeenLastCalledWith(false); expect(campo).toHaveValue("Original"); expect(texto).toHaveBeenCalled();
});
it("Esc só anuncia a restauração quando havia mudança", () => {
 render(<CampoDeTitulo titulo="Original" aoConfirmar={vi.fn()} aoTexto={vi.fn()} />);
 const campo = screen.getByRole("textbox");
 fireEvent.keyDown(campo, { key: "Escape" });
 expect(screen.getByRole("status").textContent).toBe("");
 fireEvent.change(campo, { target: { value: "Outro" } }); fireEvent.keyDown(campo, { key: "Escape" });
 expect(screen.getByRole("status")).toHaveTextContent("Título restaurado");
});
it("aoSair avisa a primeira saída do campo", () => {
 const aoSair = vi.fn();
 render(<CampoDeTitulo titulo="Original" confirmarAoSair aoSair={aoSair} aoConfirmar={vi.fn()} aoTexto={vi.fn()} />);
 const campo = screen.getByRole("textbox"); campo.focus(); fireEvent.blur(campo);
 expect(aoSair).toHaveBeenCalledTimes(1);
});
it("em nota existente, erro depois de sair do campo restaura o título atual", async () => {
 let rejeitar: (erro: Error) => void = () => {};
 const confirmar = vi.fn(() => new Promise<void>((_, falhar) => { rejeitar = falhar; }));
 render(<CampoDeTitulo titulo="Original" aoConfirmar={confirmar} aoTexto={vi.fn()} />);
 const campo = screen.getByRole("textbox"); campo.focus();
 fireEvent.change(campo, { target: { value: "Repetido" } }); fireEvent.keyDown(campo, { key: "Enter" });
 fireEvent.blur(campo);
 rejeitar(new Error("Em uso"));
 expect(await screen.findByRole("alert")).toHaveTextContent("Em uso");
 await waitFor(() => expect(campo).toHaveValue("Original"));
});
it("não notifica pendência se foi desmontado antes da resposta", async () => {
 let concluir: () => void = () => {};
 const confirmar = vi.fn(() => new Promise<void>((resolver) => { concluir = resolver; }));
 const pendencia = vi.fn();
 const { unmount } = render(<CampoDeTitulo titulo="Original" aoConfirmar={confirmar} aoTexto={vi.fn()} aoMudarPendencia={pendencia} />);
 const campo = screen.getByRole("textbox");
 fireEvent.change(campo, { target: { value: "Novo" } }); fireEvent.keyDown(campo, { key: "Enter" });
 pendencia.mockClear(); unmount(); concluir();
 await Promise.resolve(); await Promise.resolve();
 expect(pendencia).not.toHaveBeenCalled();
});
it("Enter durante composição não confirma (keyCode 229)", () => {
 const confirmar = vi.fn();
 render(<CampoDeTitulo titulo="Original" aoConfirmar={confirmar} aoTexto={vi.fn()} />);
 const campo = screen.getByRole("textbox");
 fireEvent.change(campo, { target: { value: "Novo" } }); fireEvent.keyDown(campo, { key: "Enter", keyCode: 229 });
 expect(confirmar).not.toHaveBeenCalled();
});
