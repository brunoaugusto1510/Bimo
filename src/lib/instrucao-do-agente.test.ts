import { expect, it } from "vitest";
import { gerarInstrucaoDoSistema } from "./instrucao-do-agente";

it.each(["banco", "memoria", "github"] as const)("prompt segue a fonte %s", (fonte) => {
  const prompt = gerarInstrucaoDoSistema(fonte);
  expect(prompt).not.toMatch(/vault/i);
  if (fonte === "github") {
    expect(prompt).toMatch(/commit real/);
    expect(prompt).toMatch(/GitHub/);
  } else {
    expect(prompt).toMatch(/guardadas no Bimo/);
    expect(prompt).toMatch(/histórico de versões/);
    expect(prompt).not.toMatch(/commit|GitHub/);
  }
});
