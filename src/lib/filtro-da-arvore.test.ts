import { describe, expect, it } from "vitest";
import { contarNotas, filtrarArvore } from "./filtro-da-arvore";
import type { ItemVault } from "./types";

const ARVORE: ItemVault[] = [
  {
    tipo: "pasta",
    nome: "Estudos",
    filhos: [
      {
        tipo: "pasta",
        nome: "Redes",
        filhos: [
          { tipo: "nota", nome: "TCP", caminho: "Estudos/Redes/TCP.md" },
          { tipo: "nota", nome: "DNS", caminho: "Estudos/Redes/DNS.md" },
        ],
      },
      { tipo: "nota", nome: "Álgebra Linear", caminho: "Estudos/Álgebra Linear.md" },
    ],
  },
  {
    tipo: "pasta",
    nome: "Diário",
    filhos: [{ tipo: "nota", nome: "Semana 22", caminho: "Diário/Semana 22.md" }],
  },
  { tipo: "nota", nome: "Inbox", caminho: "Inbox.md" },
];

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
        filhos: [
          {
            tipo: "pasta",
            nome: "Redes",
            filhos: [{ tipo: "nota", nome: "TCP", caminho: "Estudos/Redes/TCP.md" }],
          },
        ],
      },
    ]);
  });

  it("ignora acentos e maiúsculas, nos dois sentidos", () => {
    expect(contarNotas(filtrarArvore(ARVORE, "algebra"))).toBe(1);
    expect(contarNotas(filtrarArvore(ARVORE, "DIARIO"))).toBe(1);
    expect(contarNotas(filtrarArvore([{ tipo: "nota", nome: "Cafe", caminho: "Cafe.md" }], "café"))).toBe(1);
  });

  it("casa também pelo nome da pasta, trazendo todas as notas dela", () => {
    expect(contarNotas(filtrarArvore(ARVORE, "redes"))).toBe(2);
  });

  it("exige todas as palavras da consulta (em qualquer ordem)", () => {
    expect(contarNotas(filtrarArvore(ARVORE, "redes tcp"))).toBe(1);
    expect(contarNotas(filtrarArvore(ARVORE, "tcp redes"))).toBe(1);
    expect(contarNotas(filtrarArvore(ARVORE, "tcp diario"))).toBe(0);
  });

  it("não deixa a extensão .md atrapalhar: buscar 'md' não casa tudo", () => {
    expect(filtrarArvore(ARVORE, "md")).toEqual([]);
  });

  it("remove pastas sem nenhuma nota que combine", () => {
    const nomes = filtrarArvore(ARVORE, "inbox").map((item) => item.nome);

    expect(nomes).toEqual(["Inbox"]);
  });

  it("devolve vazio quando nada combina", () => {
    expect(filtrarArvore(ARVORE, "zzz")).toEqual([]);
  });

  it("não muda a árvore original", () => {
    const antes = JSON.stringify(ARVORE);

    filtrarArvore(ARVORE, "tcp");

    expect(JSON.stringify(ARVORE)).toBe(antes);
  });
});
