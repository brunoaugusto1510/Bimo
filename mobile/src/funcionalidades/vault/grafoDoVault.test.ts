import { montarGrafo, vizinhosDe, filtrarNotas } from "./grafoDoVault";
import { notas } from "@/dados/fixtures/notas";
import { arestas } from "@/dados/fixtures/arestas";

describe("montarGrafo", () => {
  it("cria um nó por nota", () => {
    expect(montarGrafo(notas, arestas)).toHaveLength(notas.length);
  });

  it("mantém as coordenadas dentro de 0 a 1", () => {
    for (const no of montarGrafo(notas, arestas)) {
      expect(no.x).toBeGreaterThanOrEqual(0);
      expect(no.x).toBeLessThanOrEqual(1);
      expect(no.y).toBeGreaterThanOrEqual(0);
      expect(no.y).toBeLessThanOrEqual(1);
    }
  });

  it("é determinístico: o mesmo vault dá as mesmas posições", () => {
    expect(montarGrafo(notas, arestas)).toEqual(montarGrafo(notas, arestas));
  });

  it("dá peso maior a quem tem mais conexões", () => {
    const grafo = montarGrafo(notas, arestas);
    const ordenadas = [...notas].sort((a, b) => b.conexoes - a.conexoes);
    const maior = grafo.find((no) => no.id === ordenadas[0].id);
    const menor = grafo.find((no) => no.id === ordenadas[ordenadas.length - 1].id);
    expect(maior!.peso).toBeGreaterThan(menor!.peso);
  });
});

describe("vizinhosDe", () => {
  it("acha vizinhos nas duas direções da aresta", () => {
    const vizinhos = vizinhosDe("a", [{ de: "a", para: "b" }, { de: "c", para: "a" }]);
    expect(vizinhos.sort()).toEqual(["b", "c"]);
  });

  it("devolve lista vazia para um nó isolado", () => {
    expect(vizinhosDe("z", [{ de: "a", para: "b" }])).toEqual([]);
  });
});

describe("filtrarNotas", () => {
  it("filtra por título", () => {
    const resultado = filtrarNotas(notas, notas[0].titulo.slice(0, 5), null, arestas);
    expect(resultado.map((nota) => nota.id)).toContain(notas[0].id);
  });

  it("filtra por trecho do resumo", () => {
    const termo = notas[0].resumo.split(" ")[1];
    expect(filtrarNotas(notas, termo, null, arestas).length).toBeGreaterThan(0);
  });

  it("com nó selecionado, mostra só ele e os vizinhos", () => {
    const id = notas[0].id;
    const esperados = new Set([id, ...vizinhosDe(id, arestas)]);
    const resultado = filtrarNotas(notas, "", id, arestas);
    expect(new Set(resultado.map((nota) => nota.id))).toEqual(esperados);
  });
});
