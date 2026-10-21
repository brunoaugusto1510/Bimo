import { describe, expect, it } from "vitest";
import { comAlfa, misturar } from "./cores-do-canvas";

describe("comAlfa", () => {
  it("converte hex de seis dígitos em rgba", () => {
    expect(comAlfa("#6ea8f2", 0.5)).toBe("rgba(110, 168, 242, 0.5)");
  });

  it("aceita hex de três dígitos", () => {
    expect(comAlfa("#fff", 0.25)).toBe("rgba(255, 255, 255, 0.25)");
  });

  it("limita o alfa entre 0 e 1", () => {
    expect(comAlfa("#000000", 3)).toBe("rgba(0, 0, 0, 1)");
    expect(comAlfa("#000000", -1)).toBe("rgba(0, 0, 0, 0)");
  });

  it("recorre ao color-mix quando a cor não é hex", () => {
    expect(comAlfa("hotpink", 0.4)).toBe("color-mix(in srgb, hotpink 40%, transparent)");
  });
});

describe("misturar", () => {
  it("devolve a primeira cor sem mistura e a segunda com mistura total", () => {
    expect(misturar("#000000", "#ffffff", 0)).toBe("#000000");
    expect(misturar("#000000", "#ffffff", 1)).toBe("#ffffff");
  });

  it("mistura dois hex no meio do caminho", () => {
    expect(misturar("#000000", "#ffffff", 0.5)).toBe("#808080");
  });

  it("limita a mistura entre 0 e 1", () => {
    expect(misturar("#000000", "#ffffff", 7)).toBe("#ffffff");
    expect(misturar("#000000", "#ffffff", -2)).toBe("#000000");
  });

  it("recorre ao color-mix quando alguma cor não é hex", () => {
    expect(misturar("grupo", "#ffffff", 0.25)).toBe("color-mix(in srgb, #ffffff 25%, grupo)");
  });
});
