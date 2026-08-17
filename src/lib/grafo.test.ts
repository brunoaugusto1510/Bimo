import { describe, expect, it } from "vitest";
import { obterGrupoDoCaminho } from "./grafo";

/**
 * Teste smoke da Fase 0: só prova que a config do Vitest (jsdom + alias
 * "@/*" + coverage) está funcionando, testando uma função pura que já
 * existia antes desta etapa. Os testes de verdade da Fase 1 em diante ficam
 * em arquivos próprios (ex.: `vault-real.test.ts`).
 */
describe("obterGrupoDoCaminho", () => {
  it("usa o primeiro segmento do caminho como grupo", () => {
    expect(obterGrupoDoCaminho("Estudos/Redes/TCP.md")).toBe("Estudos");
  });

  it("devolve 'Raiz' para notas sem pasta", () => {
    expect(obterGrupoDoCaminho("Bem-vindo.md")).toBe("Raiz");
  });
});
