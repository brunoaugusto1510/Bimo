import { expect, it } from "vitest";
import { identidadeDoTema } from "./identidade";

it.each(["Mercados (síntese)", "Mercados (síntese) (síntese)", " Mercados  (SINTESE)  (síntese) "])("reconhece a apresentação %s como o mesmo tema", (titulo) => {
  expect(identidadeDoTema(titulo)).toBe("mercados");
});

it("preserva qualificadores que distinguem assuntos", () => {
  expect(identidadeDoTema("Cache (navegador)")).not.toBe(identidadeDoTema("Cache (servidor)"));
  expect(identidadeDoTema("Síntese de voz")).toBe("sintese de voz");
  expect(identidadeDoTema("Economia (síntese histórica)")).toBe("economia (sintese historica)");
});
