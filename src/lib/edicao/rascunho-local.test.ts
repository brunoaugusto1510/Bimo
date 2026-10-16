import { afterEach, expect, it, vi } from "vitest";
import { criarRascunhoLocal, decidirRascunho, lerRascunho } from "./rascunho-local";
afterEach(() => vi.useRealTimers());
it("valida JSON, tipos e tamanho do armazenamento", () => {
  for (const texto of ["{", "null", "[]", JSON.stringify({ conteudo: 1 })]) expect(lerRascunho(texto)).toBeNull();
  expect(lerRascunho('{"conteudo":"a","revisaoBase":1,"em":10}')).toEqual({ conteudo: "a", revisaoBase: 1, em: 10 });
});
it("preserva rascunho grande e multibyte", () => {
  for (const conteudo of ["á".repeat(1_000_000), "a".repeat(1_000_001)]) {
    expect(lerRascunho(JSON.stringify({ conteudo, revisaoBase: 1, em: 1 }))?.conteudo).toBe(conteudo);
  }
});
it("uma instância não remove rascunho escrito por outra", () => {
  const valores = new Map<string, string>();
  const storage = { getItem: (k: string) => valores.get(k) ?? null, setItem: (k: string, v: string) => { valores.set(k, v); }, removeItem: (k: string) => { valores.delete(k); } };
  const antiga = criarRascunhoLocal("1", storage); const nova = criarRascunhoLocal("1", storage);
  antiga.guardar("igual", 1); antiga.descarregar(); nova.guardar("igual", 1); nova.descarregar();
  antiga.confirmar("igual"); expect(valores.size).toBe(1);
});
it("limita escrita, confirma somente texto igual e tolera cota cheia", () => {
  vi.useFakeTimers(); let valor: string | null = null;
  const storage = { getItem: vi.fn(() => valor), setItem: vi.fn((_k: string, v: string) => { valor = v; }), removeItem: vi.fn(() => { valor = null; }) };
  const copia = criarRascunhoLocal("1", storage); copia.guardar("a", 1); copia.guardar("b", 1);
  expect(storage.setItem).not.toHaveBeenCalled(); vi.advanceTimersByTime(500); expect(storage.setItem).toHaveBeenCalledTimes(1);
  copia.confirmar("a"); expect(storage.removeItem).not.toHaveBeenCalled(); copia.confirmar("b"); expect(storage.removeItem).toHaveBeenCalled();
  storage.setItem.mockImplementation(() => { throw new Error("cota"); }); copia.guardar("c", 2); expect(() => copia.descarregar()).not.toThrow(); copia.destruir();
});
it("decide restaurar, conflito ou nenhum", () => {
  const r = { conteudo: "local", revisaoBase: 2, em: 1 };
  expect(decidirRascunho(r, { conteudo: "servidor", revisao: 2 })).toBe("restaurar");
  expect(decidirRascunho(r, { conteudo: "servidor", revisao: 3 })).toBe("conflito");
  expect(decidirRascunho(r, { conteudo: "local", revisao: 3 })).toBe("nenhum");
});
