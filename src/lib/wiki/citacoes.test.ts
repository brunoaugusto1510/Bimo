import { expect, it } from "vitest";
import { citacaoInsuficiente, localizarCitacao, TAMANHO_MINIMO_DA_CITACAO } from "./citacoes";

it("acha a citação exata sem normalizar", () => {
  expect(localizarCitacao("abc def ghi", "def")).toEqual({ inicio: 4, fim: 7 });
});

it("tolera espaços, quebras de linha, aspas tipográficas e ênfase, apontando para o trecho original", () => {
  const texto = "Antes. O  cache\nfica “velho” e **muito** [[Rápido]] aqui.";
  const posicao = localizarCitacao(texto, 'O cache fica "velho" e muito Rápido aqui')!;
  expect(texto.slice(posicao.inicio, posicao.fim)).toBe("O  cache\nfica “velho” e **muito** [[Rápido]] aqui");
});

it("não casa paráfrase nem trechos separados", () => {
  expect(localizarCitacao("TCP garante entrega ordenada.", "TCP entrega ordenada")).toBeNull();
  expect(localizarCitacao("primeira frase. segunda frase.", "primeira frase segunda")).toBeNull();
});

it("não casa citação vazia ou só de espaços", () => {
  expect(localizarCitacao("texto", "")).toBeNull();
  expect(localizarCitacao("texto", "   \n ")).toBeNull();
});

it("citação curta só vale quando é a entrada inteira", () => {
  expect(TAMANHO_MINIMO_DA_CITACAO).toBeGreaterThan(5);
  expect(citacaoInsuficiente("a", "Bolo de cenoura leva três ovos.")).toBe(true);
  expect(citacaoInsuficiente("cenoura", "Bolo de cenoura leva três ovos.")).toBe(true);
  expect(citacaoInsuficiente("Bolo de cenoura", "Bolo de cenoura leva três ovos.")).toBe(false);
  expect(citacaoInsuficiente("Receita", "  Receita \n")).toBe(false);
});
