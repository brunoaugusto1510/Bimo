import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AlternadorDeTema from "./AlternadorDeTema";
import { ATRIBUTO_DO_TEMA, CHAVE_DO_TEMA } from "@/lib/tema";

/** `matchMedia` controlável: o teste liga e desliga o "sistema escuro" e dispara o evento de mudança. */
function simularSistema(escuroInicial: boolean) {
  let escuro = escuroInicial;
  const ouvintes = new Set<() => void>();
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation(() => ({
      get matches() {
        return escuro;
      },
      addEventListener: (_: string, ouvinte: () => void) => ouvintes.add(ouvinte),
      removeEventListener: (_: string, ouvinte: () => void) => ouvintes.delete(ouvinte),
    })),
  );
  return {
    mudarPara(novo: boolean) {
      escuro = novo;
      act(() => ouvintes.forEach((ouvinte) => ouvinte()));
    },
    ouvintes: () => ouvintes.size,
  };
}

const temaNoHtml = () => document.documentElement.getAttribute(ATRIBUTO_DO_TEMA);
const botao = () => screen.getByRole("button", { name: /^Tema / });

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute(ATRIBUTO_DO_TEMA);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AlternadorDeTema", () => {
  it("começa no automático e diz o que o próximo clique faz", () => {
    simularSistema(false);
    render(<AlternadorDeTema />);

    expect(botao()).toHaveAccessibleName("Tema automático. Mudar para claro.");
  });

  it("percorre automático → claro → escuro → automático a cada clique", async () => {
    simularSistema(false);
    render(<AlternadorDeTema />);
    const usuario = userEvent.setup();

    await usuario.click(botao());
    expect(botao()).toHaveAccessibleName("Tema claro. Mudar para escuro.");

    await usuario.click(botao());
    expect(botao()).toHaveAccessibleName("Tema escuro. Mudar para automático.");

    await usuario.click(botao());
    expect(botao()).toHaveAccessibleName("Tema automático. Mudar para claro.");
  });

  it("aplica o tema escolhido no <html> e o guarda para a próxima visita", async () => {
    simularSistema(true);
    render(<AlternadorDeTema />);
    const usuario = userEvent.setup();
    // Automático com o sistema escuro: a página já está escura.
    expect(temaNoHtml()).toBe("escuro");

    await usuario.click(botao()); // → claro, mesmo com o sistema escuro

    expect(temaNoHtml()).toBe("claro");
    expect(localStorage.getItem(CHAVE_DO_TEMA)).toBe("claro");
  });

  it("volta a escolha salva ao abrir", () => {
    simularSistema(false);
    localStorage.setItem(CHAVE_DO_TEMA, "escuro");

    render(<AlternadorDeTema />);

    expect(botao()).toHaveAccessibleName("Tema escuro. Mudar para automático.");
    expect(temaNoHtml()).toBe("escuro");
  });

  it("no automático, acompanha o sistema quando ele muda com a página aberta", () => {
    const sistema = simularSistema(false);
    render(<AlternadorDeTema />);
    expect(temaNoHtml()).toBe("claro");

    sistema.mudarPara(true);

    expect(temaNoHtml()).toBe("escuro");
  });

  it("com um tema fixo, ignora o sistema", async () => {
    const sistema = simularSistema(false);
    render(<AlternadorDeTema />);
    await userEvent.setup().click(botao()); // → claro, fixo

    sistema.mudarPara(true);

    expect(temaNoHtml()).toBe("claro");
  });

  it("para de ouvir o sistema ao sair da tela", () => {
    const sistema = simularSistema(false);
    const { unmount } = render(<AlternadorDeTema />);
    expect(sistema.ouvintes()).toBe(1);

    unmount();

    expect(sistema.ouvintes()).toBe(0);
  });
});
