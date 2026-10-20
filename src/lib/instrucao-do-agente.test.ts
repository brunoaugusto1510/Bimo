import { expect, it } from "vitest";
import { gerarInstrucaoDoSistema } from "./instrucao-do-agente";

it("o prompt diz que as notas ficam no Bimo, com histórico de versões, e nunca fala em vault, commit ou GitHub", () => {
  const prompt = gerarInstrucaoDoSistema();
  expect(prompt).not.toMatch(/vault/i);
  expect(prompt).toMatch(/guardadas no Bimo/);
  expect(prompt).toMatch(/histórico de versões/);
  expect(prompt).not.toMatch(/commit|GitHub/);
});
