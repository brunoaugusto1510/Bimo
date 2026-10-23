import { describe, expect, it } from "vitest";
import { buscarPorTitulo, type NotaParaBusca } from "./busca-por-titulo";

function nota(id: string, titulo: string, pasta: string | null = null): NotaParaBusca {
  return { id, titulo, pasta };
}

const NOTAS = [
  nota("1", "Ler é uma conversa", "Leituras"),
  nota("2", "Marginália: ler com caneta na mão", "Leituras"),
  nota("3", "Reler antes de dormir", "Diário"),
  nota("4", "Ler", "Leituras"),
  nota("5", "Café: variáveis"),
  nota("6", "Notas atômicas", "Método"),
];

const titulos = (resultados: ReturnType<typeof buscarPorTitulo>) => resultados.map((r) => r.nota.titulo);

describe("buscarPorTitulo", () => {
  it("põe o título igual à consulta primeiro, depois o que começa com ela, depois o resto", () => {
    expect(titulos(buscarPorTitulo(NOTAS, "ler"))).toEqual([
      "Ler",
      "Ler é uma conversa",
      "Marginália: ler com caneta na mão",
      "Reler antes de dormir",
    ]);
  });

  it("início de palavra vale mais que o meio de uma palavra", () => {
    const resultados = buscarPorTitulo([nota("a", "Reler"), nota("b", "Para ler")], "ler");

    expect(titulos(resultados)).toEqual(["Para ler", "Reler"]);
  });

  it("ignora acentos e maiúsculas", () => {
    expect(titulos(buscarPorTitulo(NOTAS, "CAFE VARIAVEIS"))).toEqual(["Café: variáveis"]);
    expect(titulos(buscarPorTitulo(NOTAS, "atomicas"))).toEqual(["Notas atômicas"]);
  });

  it("aceita letras salteadas, na ordem, como último recurso", () => {
    expect(titulos(buscarPorTitulo(NOTAS, "nos"))).toEqual(["Notas atômicas"]);
    expect(buscarPorTitulo(NOTAS, "zzz")).toEqual([]);
  });

  it("exige todas as palavras da consulta, em qualquer ordem", () => {
    expect(titulos(buscarPorTitulo(NOTAS, "conversa uma"))).toEqual(["Ler é uma conversa"]);
    expect(buscarPorTitulo(NOTAS, "conversa dormir")).toEqual([]);
  });

  it("também acha pelo caminho 'Pasta/Título'", () => {
    expect(titulos(buscarPorTitulo(NOTAS, "diario/reler"))).toEqual(["Reler antes de dormir"]);
  });

  describe("intervalos para destacar", () => {
    it("devolvem as posições no título original, mesmo com acentos", () => {
      const [resultado] = buscarPorTitulo(NOTAS, "variaveis");
      const trechos = resultado.intervalos.map(([inicio, fim]) => resultado.nota.titulo.slice(inicio, fim));

      expect(trechos).toEqual(["variáveis"]);
    });

    it("marcam cada palavra da consulta", () => {
      const [resultado] = buscarPorTitulo(NOTAS, "uma conv");
      const trechos = resultado.intervalos.map(([inicio, fim]) => resultado.nota.titulo.slice(inicio, fim));

      expect(trechos).toEqual(["uma", "conv"]);
    });

    it("no caso de letras salteadas, juntam as vizinhas", () => {
      const [resultado] = buscarPorTitulo([nota("a", "Notas atômicas")], "nta");

      expect(resultado.intervalos).toEqual([[0, 1], [2, 4]]);
    });

    const marcados = (titulo: string, consulta: string) => {
      const [resultado] = buscarPorTitulo([nota("a", titulo)], consulta);
      return resultado.intervalos.map(([inicio, fim]) => titulo.slice(inicio, fim));
    };

    it("marcam um emoji inteiro, nunca metade dele", () => {
      expect(marcados("🎉 festa", "🎉")).toEqual(["🎉"]);
      expect(marcados("Lista 📚", "📚")).toEqual(["📚"]);
      expect(marcados("x😀yz", "😀z")).toEqual(["😀", "z"]);
    });

    it("marcam a letra junto com o acento solto que vem depois dela (texto decomposto)", () => {
      expect(marcados("Café com leite", "cafe")).toEqual(["Café"]);
    });

    it("não marcam nada quando o acerto foi só no caminho da pasta", () => {
      const [resultado] = buscarPorTitulo(NOTAS, "diario/reler");

      expect(resultado.intervalos).toEqual([]);
    });
  });

  describe("consulta vazia", () => {
    it("mostra as recentes primeiro, na ordem delas, e depois as demais por nome", () => {
      const resultados = buscarPorTitulo(NOTAS, "  ", ["6", "5"]);

      expect(titulos(resultados).slice(0, 2)).toEqual(["Notas atômicas", "Café: variáveis"]);
      expect(titulos(resultados).slice(2)).toEqual(["Ler", "Ler é uma conversa", "Marginália: ler com caneta na mão", "Reler antes de dormir"]);
    });

    it("ignora recentes que não existem mais", () => {
      expect(buscarPorTitulo(NOTAS, "", ["999"])).toHaveLength(NOTAS.length);
    });
  });

  it("entre acertos de mesma força, as recentes vêm antes", () => {
    const resultados = buscarPorTitulo([nota("a", "Resumo A"), nota("b", "Resumo B")], "resumo", ["b"]);

    expect(titulos(resultados)).toEqual(["Resumo B", "Resumo A"]);
  });

  it("respeita o limite de resultados", () => {
    const muitas = Array.from({ length: 100 }, (_, i) => nota(String(i), `Nota ${i}`));

    expect(buscarPorTitulo(muitas, "nota")).toHaveLength(50);
    expect(buscarPorTitulo(muitas, "nota", [], 5)).toHaveLength(5);
  });

  it("limita e ordena os resultados em uma base de cinco mil notas", () => {
    const muitas = Array.from({ length: 5000 }, (_, i) => nota(String(i), `Nota de estudo número ${i}`, `Pasta ${i % 20}`));

    const resultados = buscarPorTitulo(muitas, "estudo 4", []);
    expect(resultados).toHaveLength(50);
    expect(new Set(resultados.map((r) => r.nota.id)).size).toBe(50);
    expect(resultados.every((r) => r.nota.titulo.includes("estudo") && r.nota.titulo.includes("4"))).toBe(true);
  });
});
