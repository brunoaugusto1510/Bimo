import { describe, expect, it } from "vitest";
import { criarResolvedor } from "../ligacoes";
import { sugerirLigacoes } from "./sugestoes-de-ligacao";

const notas = [
  { id: "1", titulo: "Receitas", pasta: "Cozinha" },
  { id: "2", titulo: "Reunião", pasta: "Trabalho" },
  { id: "3", titulo: "Reunião", pasta: "Pessoal" },
  { id: "4", titulo: "Rede de contatos", pasta: null },
  { id: "5", titulo: "Atual", pasta: null },
];
const resolver = criarResolvedor(notas);
const sugerir = (consulta: string, extra: Partial<Parameters<typeof sugerirLigacoes>[0]> = {}) =>
  sugerirLigacoes({ notas, consulta, idAtual: "5", pastaAtual: null, resolver, ...extra });

describe("sugerirLigacoes", () => {
  it("ordena pelo título e nunca sugere a própria nota", () => {
    expect(sugerir("re").map((s) => s.id).sort()).toEqual(["1", "2", "3", "4"]);
    expect(sugerir("atual")).toEqual([]);
  });
  it("usa só o título no alvo quando ele leva a essa nota", () => {
    expect(sugerir("receitas")[0]).toMatchObject({ id: "1", titulo: "Receitas", alvo: "Receitas" });
  });
  it("usa Pasta/Título quando o título é repetido (a ligação precisa apontar para uma só)", () => {
    const reunioes = sugerir("reunião");
    expect(reunioes.map((s) => s.alvo).sort()).toEqual(["Pessoal/Reunião", "Trabalho/Reunião"]);
  });
  it("uma nota na raiz sem repetição usa só o título", () => {
    expect(sugerir("rede")[0].alvo).toBe("Rede de contatos");
  });
  it("devolve os trechos que casaram para destacar", () => {
    expect(sugerir("rece")[0].intervalos).toEqual([[0, 4]]);
  });
  it("respeita o limite (8 por padrão)", () => {
    const muitas = Array.from({ length: 20 }, (_, i) => ({ id: `n${i}`, titulo: `Nota ${i}`, pasta: null }));
    const base = { notas: muitas, consulta: "nota", idAtual: "x", pastaAtual: null, resolver: criarResolvedor(muitas) };
    expect(sugerirLigacoes(base)).toHaveLength(8);
    expect(sugerirLigacoes({ ...base, limite: 3 })).toHaveLength(3);
  });
  it("consulta vazia lista notas por nome (a pessoa acabou de digitar [[)", () => {
    expect(sugerir("")).toHaveLength(4);
  });
  it("ignora acentos e maiúsculas", () => {
    expect(sugerir("REUNIAO").map((s) => s.id).sort()).toEqual(["2", "3"]);
  });
});
