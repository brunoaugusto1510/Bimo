import { expect, it } from "vitest";
import { criarLimitadorDeUso } from "./limite-de-uso";

it("usa janela deslizante, isola chaves e não prolonga bloqueios", () => {
  let agora = 0;
  const limite = criarLimitadorDeUso({ maximo: 2, janelaMs: 60_000, agora: () => agora });
  expect(limite.tentar("a")).toEqual({ permitido: true });
  agora = 30_000;
  expect(limite.tentar("a")).toEqual({ permitido: true });
  agora = 30_001;
  expect(limite.tentar("a")).toEqual({ permitido: false, esperarSegundos: 30 });
  expect(limite.tentar("b")).toEqual({ permitido: true });
  agora = 60_000;
  expect(limite.tentar("a")).toEqual({ permitido: true });
  expect(limite.tentar("a")).toEqual({ permitido: false, esperarSegundos: 30 });
  agora = 120_000;
  expect(limite.tentar("a")).toEqual({ permitido: true });
  expect(limite.tentar("b")).toEqual({ permitido: true });
});
