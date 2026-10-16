import { describe, expect, it } from "vitest";
import { combinaAtalho, type EventoDeTecla } from "./atalhos";

function tecla(key: string, extras: Partial<EventoDeTecla> = {}): EventoDeTecla {
  return { key, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, isComposing: false, ...extras };
}

describe("combinaAtalho", () => {
  it("mod+o vale com Ctrl (Windows e Linux) e com Cmd (Mac)", () => {
    expect(combinaAtalho(tecla("o", { ctrlKey: true }), "mod+o")).toBe(true);
    expect(combinaAtalho(tecla("o", { metaKey: true }), "mod+o")).toBe(true);
  });

  it("não aceita a tecla sozinha nem com outro modificador por cima", () => {
    expect(combinaAtalho(tecla("o"), "mod+o")).toBe(false);
    expect(combinaAtalho(tecla("o", { ctrlKey: true, shiftKey: true }), "mod+o")).toBe(false);
    expect(combinaAtalho(tecla("o", { ctrlKey: true, altKey: true }), "mod+o")).toBe(false);
  });

  it("não confunde teclas diferentes", () => {
    expect(combinaAtalho(tecla("p", { ctrlKey: true }), "mod+o")).toBe(false);
  });

  it("ignora a caixa da letra (Caps Lock, Shift)", () => {
    expect(combinaAtalho(tecla("O", { ctrlKey: true }), "mod+o")).toBe(true);
  });

  it("entende alt+n e mod+shift+enter", () => {
    expect(combinaAtalho(tecla("n", { altKey: true }), "alt+n")).toBe(true);
    expect(combinaAtalho(tecla("n", { altKey: true, ctrlKey: true }), "alt+n")).toBe(false);
    expect(combinaAtalho(tecla("Enter", { ctrlKey: true, shiftKey: true }), "mod+shift+enter")).toBe(true);
    expect(combinaAtalho(tecla("Enter", { ctrlKey: true }), "mod+shift+enter")).toBe(false);
  });

  it("entende teclas pelo nome, sem diferenciar a caixa", () => {
    expect(combinaAtalho(tecla("Enter"), "enter")).toBe(true);
    expect(combinaAtalho(tecla("Escape"), "escape")).toBe(true);
  });

  it("ignora o que acontece durante a composição de texto (acentos, teclado de celular)", () => {
    expect(combinaAtalho(tecla("o", { ctrlKey: true, isComposing: true }), "mod+o")).toBe(false);
  });
});
