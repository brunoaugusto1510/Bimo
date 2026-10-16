import { describe, expect, it } from "vitest";
import { construirArvore, contarNotas, filtrarArvore, indexarNotas, type NotaParaArvore } from "./arvore-de-notas";
import type { ItemDeNotas } from "./types";

function nota(id: string, titulo: string, pasta: string | null = null): NotaParaArvore {
  return { id, titulo, pasta };
}

const NOTAS: NotaParaArvore[] = [
  nota("1", "TCP", "Estudos/Redes"),
  nota("2", "DNS", "Estudos/Redes"),
  nota("3", "Álgebra Linear", "Estudos"),
  nota("4", "Semana 22", "Diário"),
  nota("5", "Inbox"),
];

describe("construirArvore", () => {
  it("agrupa as notas em pastas aninhadas, com a nota carregando o id e a pasta", () => {
    const arvore = construirArvore(NOTAS);

    expect(arvore.map((item) => item.nome)).toEqual(["Diário", "Estudos", "Inbox"]);

    const estudos = arvore[1];
    expect(estudos).toMatchObject({ tipo: "pasta", nome: "Estudos", caminho: "Estudos" });
    if (estudos.tipo !== "pasta") throw new Error("esperava uma pasta");

    expect(estudos.filhos.map((item) => item.nome)).toEqual(["Redes", "Álgebra Linear"]);
    expect(estudos.filhos[0]).toMatchObject({ tipo: "pasta", caminho: "Estudos/Redes" });
    expect(estudos.filhos[1]).toEqual({ tipo: "nota", id: "3", nome: "Álgebra Linear", pasta: "Estudos" });
  });

  it("põe as pastas antes das notas e ordena por nome em pt-BR", () => {
    const arvore = construirArvore([nota("1", "Zebra"), nota("2", "Árvore"), nota("3", "Nota", "Pasta")]);

    expect(arvore.map((item) => item.nome)).toEqual(["Pasta", "Árvore", "Zebra"]);
  });

  it("notas com o mesmo título em pastas diferentes aparecem cada uma na sua", () => {
    const arvore = construirArvore([nota("1", "Resumo", "A"), nota("2", "Resumo", "B")]);

    expect(contarNotas(arvore)).toBe(2);
  });

  it("devolve vazio sem notas", () => {
    expect(construirArvore([])).toEqual([]);
  });
});

const ARVORE: ItemDeNotas[] = construirArvore(NOTAS);

describe("indexarNotas", () => {
  it("achata a árvore num mapa por id, com título e pasta de cada nota", () => {
    const mapa = indexarNotas(ARVORE);

    expect(mapa.size).toBe(5);
    expect(mapa.get("1")).toEqual({ id: "1", titulo: "TCP", pasta: "Estudos/Redes" });
    expect(mapa.get("5")).toEqual({ id: "5", titulo: "Inbox", pasta: null });
  });

  it("uma árvore vazia dá um mapa vazio", () => {
    expect(indexarNotas([]).size).toBe(0);
  });
});

describe("contarNotas", () => {
  it("conta as notas de toda a árvore, em qualquer profundidade", () => {
    expect(contarNotas(ARVORE)).toBe(5);
  });

  it("devolve 0 para uma árvore vazia", () => {
    expect(contarNotas([])).toBe(0);
  });
});

describe("filtrarArvore", () => {
  it("devolve a árvore original quando a consulta está vazia ou só tem espaços", () => {
    expect(filtrarArvore(ARVORE, "")).toBe(ARVORE);
    expect(filtrarArvore(ARVORE, "   ")).toBe(ARVORE);
  });

  it("acha a nota pelo nome e mantém as pastas que a contêm", () => {
    const resultado = filtrarArvore(ARVORE, "tcp");

    expect(resultado).toEqual([
      {
        tipo: "pasta",
        nome: "Estudos",
        caminho: "Estudos",
        filhos: [
          {
            tipo: "pasta",
            nome: "Redes",
            caminho: "Estudos/Redes",
            filhos: [{ tipo: "nota", id: "1", nome: "TCP", pasta: "Estudos/Redes" }],
          },
        ],
      },
    ]);
  });

  it("ignora acentos e maiúsculas, nos dois sentidos", () => {
    expect(contarNotas(filtrarArvore(ARVORE, "algebra"))).toBe(1);
    expect(contarNotas(filtrarArvore(ARVORE, "DIARIO"))).toBe(1);
    expect(contarNotas(filtrarArvore(construirArvore([nota("9", "Cafe")]), "café"))).toBe(1);
  });

  it("casa também pelo nome da pasta, trazendo todas as notas dela", () => {
    expect(contarNotas(filtrarArvore(ARVORE, "redes"))).toBe(2);
  });

  it("exige todas as palavras da consulta (em qualquer ordem)", () => {
    expect(contarNotas(filtrarArvore(ARVORE, "redes tcp"))).toBe(1);
    expect(contarNotas(filtrarArvore(ARVORE, "tcp redes"))).toBe(1);
    expect(contarNotas(filtrarArvore(ARVORE, "tcp diario"))).toBe(0);
  });

  it("devolve vazio quando nada combina", () => {
    expect(filtrarArvore(ARVORE, "zzz")).toEqual([]);
  });

  it("remove pastas sem nenhuma nota que combine", () => {
    expect(filtrarArvore(ARVORE, "inbox").map((item) => item.nome)).toEqual(["Inbox"]);
  });

  it("não muda a árvore original", () => {
    const antes = JSON.stringify(ARVORE);

    filtrarArvore(ARVORE, "tcp");

    expect(JSON.stringify(ARVORE)).toBe(antes);
  });
});
