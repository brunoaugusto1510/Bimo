import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import SeletorPill from "./SeletorPill";

const OPCOES = [
  { valor: "bimo", rotulo: "Bimo" },
  { valor: "notas", rotulo: "Notas" },
] as const;

describe("SeletorPill", () => {
  it("mostra todas as opções, com exatamente uma ativa", () => {
    render(<SeletorPill rotulo="Modo" opcoes={OPCOES} valor="notas" onChange={() => {}} />);

    expect(screen.getByRole("button", { name: "Bimo" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Notas" })).toHaveAttribute("aria-pressed", "true");
  });

  it("agrupa as opções sob o rótulo recebido, para leitor de tela", () => {
    render(<SeletorPill rotulo="Modo de visualização" opcoes={OPCOES} valor="bimo" onChange={() => {}} />);

    expect(screen.getByRole("group", { name: "Modo de visualização" })).toBeInTheDocument();
  });

  it("avisa a opção escolhida ao clicar numa inativa", async () => {
    const aoMudar = vi.fn();
    render(<SeletorPill rotulo="Modo" opcoes={OPCOES} valor="bimo" onChange={aoMudar} />);

    await userEvent.setup().click(screen.getByRole("button", { name: "Notas" }));

    expect(aoMudar).toHaveBeenCalledExactlyOnceWith("notas");
  });

  it("não avisa nada ao clicar na opção que já está ativa", async () => {
    const aoMudar = vi.fn();
    render(<SeletorPill rotulo="Modo" opcoes={OPCOES} valor="bimo" onChange={aoMudar} />);

    await userEvent.setup().click(screen.getByRole("button", { name: "Bimo" }));

    expect(aoMudar).not.toHaveBeenCalled();
  });
});
