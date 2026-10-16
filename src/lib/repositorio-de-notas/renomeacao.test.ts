import { describe, expect, it } from "vitest";
import type { NotaComConteudo } from "../indice-de-ligacoes";
import { planejarMudanca, planejarRenomeacao } from "./renomeacao";

function nota(id: string, titulo: string, conteudo: string, pasta: string | null = null): NotaComConteudo {
  return { id, titulo, pasta, conteudo };
}

describe("planejarRenomeacao", () => {
  it("reescreve as ligações que apontavam para a nota, preservando seção e apelido", () => {
    const notas = [
      nota("1", "Antigo", ""),
      nota("2", "Outra", "veja [[Antigo]], [[Antigo|apelido]] e [[Antigo#Seção]] e ![[Antigo]]"),
    ];

    expect(planejarRenomeacao(notas, "1", "Novo")).toEqual([
      { id: "2", conteudo: "veja [[Novo]], [[Novo|apelido]] e [[Novo#Seção]] e ![[Novo]]" },
    ]);
  });

  it("mantém o caminho de pasta que a ligação já usava", () => {
    const notas = [nota("1", "Antigo", "", "Pasta"), nota("2", "Outra", "[[Pasta/Antigo]]")];

    expect(planejarRenomeacao(notas, "1", "Novo")).toEqual([{ id: "2", conteudo: "[[Pasta/Novo]]" }]);
  });

  it("reescreve também as ligações da própria nota para ela mesma", () => {
    const notas = [nota("1", "Antigo", "eu mesma: [[Antigo]]")];

    expect(planejarRenomeacao(notas, "1", "Novo")).toEqual([{ id: "1", conteudo: "eu mesma: [[Novo]]" }]);
  });

  it("não mexe nas ligações que apontavam para uma homônima de outra pasta", () => {
    const notas = [
      nota("1", "Antigo", "", "Pasta1"),
      nota("2", "Antigo", "", "Pasta2"),
      nota("3", "Vizinha", "[[Antigo]]", "Pasta2"),
    ];

    // A ligação de "Vizinha" resolve para a "Antigo" da Pasta2 (mesma pasta): renomear a da Pasta1 não a afeta.
    expect(planejarRenomeacao(notas, "1", "Novo")).toEqual([]);
    expect(planejarRenomeacao(notas, "2", "Novo")).toEqual([{ id: "3", conteudo: "[[Novo]]" }]);
  });

  it("não toca código, anexos nem ligações que não resolvem", () => {
    const notas = [nota("1", "Antigo", ""), nota("2", "Outra", "`[[Antigo]]` ![[Antigo.png]] [[Fantasma]]")];

    expect(planejarRenomeacao(notas, "1", "Novo")).toEqual([]);
  });

  it("não desvia para a nota renomeada uma ligação que apontava para outra de mesmo título novo", () => {
    const notas = [
      nota("1", "Alvo", "", "P"),
      nota("2", "Novo", "", "Q"),
      nota("3", "Origem", "[[Novo]] e [[Alvo]]", "P"),
    ];

    // Depois de renomear a 1 para "Novo", [[Novo]] na pasta P passaria a resolver para ela: a ligação
    // que era da nota 2 precisa carregar o caminho dela.
    expect(planejarRenomeacao(notas, "1", "Novo")).toEqual([{ id: "3", conteudo: "[[Q/Novo]] e [[Novo]]" }]);
  });

  it("devolve vazio quando o título não muda", () => {
    const notas = [nota("1", "Antigo", ""), nota("2", "Outra", "[[Antigo]]")];

    expect(planejarRenomeacao(notas, "1", "Antigo")).toEqual([]);
  });
});

describe("planejarMudanca — mover de pasta", () => {
  it("reescreve para o caminho novo as ligações com caminho, que deixariam de resolver", () => {
    const notas = [nota("1", "N", "", "A"), nota("2", "Outra", "veja [[A/N]]")];

    expect(planejarMudanca(notas, "1", { pasta: "B" })).toEqual([{ id: "2", conteudo: "veja [[B/N]]" }]);
  });

  it("deixa as ligações só com o título, que continuam resolvendo", () => {
    const notas = [nota("1", "N", "", "A"), nota("2", "Outra", "veja [[N]]")];

    expect(planejarMudanca(notas, "1", { pasta: "B" })).toEqual([]);
  });

  it("renomear e mover juntos leva a ligação antiga ao caminho novo completo", () => {
    const notas = [nota("1", "N", "", "A"), nota("2", "Outra", "[[A/N|apelido]]")];

    expect(planejarMudanca(notas, "1", { titulo: "M", pasta: "B" })).toEqual([
      { id: "2", conteudo: "[[B/M|apelido]]" },
    ]);
  });

  it("a nota movida continua apontando para a mesma nota, mesmo que a pasta nova tenha uma homônima", () => {
    const notas = [
      nota("1", "Movida", "[[X]]", "A"),
      nota("2", "X", "", "A"),
      nota("3", "X", "", "B"),
    ];

    expect(planejarMudanca(notas, "1", { pasta: "B" })).toEqual([{ id: "1", conteudo: "[[A/X]]" }]);
  });
});
