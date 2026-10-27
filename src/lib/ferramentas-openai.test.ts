import { expect, it } from "vitest";
import { ferramentasOpenAI } from "./ferramentas-openai";

it("declara as seis ferramentas com schemas estritos e campos opcionais anuláveis", () => {
  expect(ferramentasOpenAI.map((f) => f.name)).toEqual(["buscar_notas", "listar_notas", "ler_nota", "indice_da_wiki", "criar_nota", "editar_nota"]);
  for (const ferramenta of ferramentasOpenAI) {
    expect(ferramenta).toMatchObject({ type: "function", strict: true });
    expect(ferramenta.parameters.additionalProperties).toBe(false);
    expect(ferramenta.parameters.required).toEqual(Object.keys(ferramenta.parameters.properties));
  }
  expect(ferramentasOpenAI[0].parameters.properties.limite).toMatchObject({ type: ["integer", "null"] });
  expect(ferramentasOpenAI[1].parameters.properties.pasta).toMatchObject({ type: ["string", "null"] });
});
