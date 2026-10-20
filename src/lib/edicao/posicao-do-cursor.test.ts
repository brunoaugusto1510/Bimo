import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { posicaoDoCursor } from "./posicao-do-cursor";

let campo: HTMLTextAreaElement;
let espelho: HTMLElement | null;
let altura = 22;

beforeEach(() => {
  campo = document.createElement("textarea");
  campo.value = "Olá\nmundo";
  campo.scrollTop = 7;
  campo.scrollLeft = 3;
  document.body.append(campo);
  espelho = null;
  altura = 22;
  vi.spyOn(window, "getComputedStyle").mockReturnValue({
    fontFamily: "monospace", fontSize: "20px", fontWeight: "500", fontStyle: "italic",
    letterSpacing: "1px", lineHeight: "24px", textTransform: "uppercase", textIndent: "2px",
    wordSpacing: "3px", tabSize: "4", paddingTop: "4px", paddingRight: "5px",
    paddingBottom: "6px", paddingLeft: "7px", borderTopWidth: "1px", borderRightWidth: "2px",
    borderBottomWidth: "3px", borderLeftWidth: "4px", boxSizing: "border-box", width: "320px",
  } as CSSStyleDeclaration);
  vi.spyOn(HTMLElement.prototype, "offsetTop", "get").mockImplementation(function (this: HTMLElement) {
    espelho = this.parentElement;
    expect(espelho?.isConnected).toBe(true);
    return 40;
  });
  vi.spyOn(HTMLElement.prototype, "offsetLeft", "get").mockReturnValue(18);
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(() => altura);
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe("posicaoDoCursor", () => {
  it("mede o marcador, desconta a rolagem e remove o espelho", () => {
    expect(posicaoDoCursor(campo, 4)).toEqual({ topo: 33, esquerda: 15, altura: 22 });
    expect(espelho?.firstChild?.textContent).toBe("Olá\n");
    expect(espelho?.querySelector("span")?.textContent).toBe("\u200b");
    expect(espelho?.isConnected).toBe(false);
    expect(document.body.children).toHaveLength(1);
  });

  it("copia todas as propriedades do fluxo e mantém o espelho oculto fora da tela", () => {
    posicaoDoCursor(campo, 2);
    const estilo = getComputedStyle(campo);
    for (const propriedade of Object.keys(estilo)) {
      expect(espelho?.style[propriedade as keyof CSSStyleDeclaration]).toBe(estilo[propriedade as keyof CSSStyleDeclaration]);
    }
    expect(espelho?.style.position).toBe("absolute");
    expect(espelho?.style.visibility).toBe("hidden");
    expect(espelho?.style.whiteSpace).toBe("pre-wrap");
    expect(espelho?.style.overflowWrap).toBe("break-word");
    expect(parseFloat(espelho?.style.left ?? "")).toBeLessThan(0);
  });

  it.each([[-5, ""], [999, "Olá\nmundo"], [0, ""], [9, "Olá\nmundo"]])("limita o índice %i", (indice, prefixo) => {
    posicaoDoCursor(campo, indice);
    expect(espelho?.textContent).toBe(`${prefixo}\u200b`);
    expect(espelho?.isConnected).toBe(false);
  });

  it.each([["24px", 24], ["normal", 24]])("usa altura alternativa para lineHeight %s", (lineHeight, esperada) => {
    altura = 0;
    vi.mocked(getComputedStyle).mockReturnValue({ ...getComputedStyle(campo), lineHeight } as CSSStyleDeclaration);
    expect(posicaoDoCursor(campo, 0).altura).toBe(esperada);
  });

  it("remove o espelho mesmo se a medição lançar erro", () => {
    vi.spyOn(HTMLElement.prototype, "offsetLeft", "get").mockImplementation(() => { throw new Error("sem medida"); });
    expect(() => posicaoDoCursor(campo, 2)).toThrow("sem medida");
    expect(espelho?.isConnected).toBe(false);
    expect(document.body.children).toHaveLength(1);
  });
});
