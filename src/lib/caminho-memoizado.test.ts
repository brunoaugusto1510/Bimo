import { describe, expect, it } from "vitest";
import { criarCacheDeCaminhos, criarQuadroDoRastroMemoizado } from "./caminho-memoizado";
import { encerrarRastro, iniciarRastro, registrarPasso } from "./rastro-do-agente";

const VIZINHOS = new Map<string, ReadonlySet<string>>([
  ["a", new Set(["b"])],
  ["b", new Set(["a", "c"])],
  ["c", new Set(["b"])],
]);
const RASTRO = {};

describe("criarCacheDeCaminhos", () => {
  it("acha o caminho mais curto", () => {
    const cache = criarCacheDeCaminhos();

    expect(cache.buscador(VIZINHOS, RASTRO)("a", "c")).toEqual(["a", "b", "c"]);
  });

  it("não refaz a busca para o mesmo par enquanto vizinhos e rastro são os mesmos", () => {
    const cache = criarCacheDeCaminhos();
    const primeiro = cache.buscador(VIZINHOS, RASTRO)("a", "c");
    const segundo = cache.buscador(VIZINHOS, RASTRO)("a", "c");

    expect(segundo).toBe(primeiro);
    expect(cache.tamanho()).toBe(1);
  });

  it("guarda também a ausência de caminho", () => {
    const cache = criarCacheDeCaminhos();
    const isolados = new Map<string, ReadonlySet<string>>();

    expect(cache.buscador(isolados, RASTRO)("x", "y")).toBeNull();
    expect(cache.buscador(isolados, RASTRO)("x", "y")).toBeNull();
    expect(cache.tamanho()).toBe(1);
  });

  it("limpa quando o mapa de vizinhos muda", () => {
    const cache = criarCacheDeCaminhos();
    cache.buscador(VIZINHOS, RASTRO)("a", "c");

    const novo = new Map<string, ReadonlySet<string>>(VIZINHOS);
    expect(cache.buscador(novo, RASTRO)("a", "c")).toEqual(["a", "b", "c"]);
    expect(cache.tamanho()).toBe(1);
  });

  it("limpa quando o rastro é outro objeto", () => {
    const cache = criarCacheDeCaminhos();
    cache.buscador(VIZINHOS, RASTRO)("a", "c");
    cache.buscador(VIZINHOS, RASTRO)("a", "b");
    expect(cache.tamanho()).toBe(2);

    cache.buscador(VIZINHOS, {})("a", "b");
    expect(cache.tamanho()).toBe(1);
  });

  it("aceita rastro nulo", () => {
    const cache = criarCacheDeCaminhos();

    expect(cache.buscador(VIZINHOS, null)("a", "b")).toEqual(["a", "b"]);
  });
});

describe("criarQuadroDoRastroMemoizado", () => {
  const encerrado = () => {
    let rastro = iniciarRastro(0);
    rastro = registrarPasso(rastro, { tipo: "leitura", id: "a" }, 100);
    rastro = registrarPasso(rastro, { tipo: "leitura", id: "c" }, 200);
    return encerrarRastro(rastro, 300);
  };

  it("refaz o quadro a cada chamada enquanto o rastro está animando", () => {
    const quadro = criarQuadroDoRastroMemoizado();
    const rastro = registrarPasso(iniciarRastro(0), { tipo: "leitura", id: "a" }, 100);

    expect(quadro(rastro, 150, VIZINHOS)).not.toBe(quadro(rastro, 160, VIZINHOS));
  });

  it("reaproveita o quadro depois que o rastro acabou de animar", () => {
    const quadro = criarQuadroDoRastroMemoizado();
    const rastro = encerrado();

    const primeiro = quadro(rastro, 100000, VIZINHOS);

    expect(primeiro.ativo).toBe(false);
    expect(quadro(rastro, 100016, VIZINHOS)).toBe(primeiro);
  });

  it("refaz o quadro quando o rastro ou o grafo trocam de objeto", () => {
    const quadro = criarQuadroDoRastroMemoizado();
    const rastro = encerrado();
    const primeiro = quadro(rastro, 100000, VIZINHOS);

    expect(quadro(encerrado(), 100000, VIZINHOS)).not.toBe(primeiro);
    expect(quadro(rastro, 100000, new Map(VIZINHOS))).not.toBe(primeiro);
  });

  it("os caminhos dos trechos saem do grafo", () => {
    const quadro = criarQuadroDoRastroMemoizado();

    expect(quadro(encerrado(), 100000, VIZINHOS).segmentos[0].ids).toEqual(["a", "b", "c"]);
  });
});
