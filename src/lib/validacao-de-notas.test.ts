import { describe, expect, it } from "vitest";
import {
  esquemaDeAtualizacao,
  esquemaDeBusca,
  esquemaDeCriacao,
  esquemaDeIdDeNota,
  esquemaDeRenomeacao,
} from "./validacao-de-notas";

describe("esquemaDeCriacao", () => {
  it("aceita só o título e apara espaços", () => {
    const resultado = esquemaDeCriacao.safeParse({ titulo: "  Minha nota " });

    expect(resultado.success && resultado.data).toEqual({ titulo: "Minha nota" });
  });

  it("normaliza a pasta e as tags", () => {
    const resultado = esquemaDeCriacao.safeParse({
      titulo: "A",
      pasta: " / Faculdade // Redes / ",
      conteudo: "texto",
      tags: ["#Redes", " redes ", "", "estudo"],
    });

    expect(resultado.success && resultado.data).toEqual({
      titulo: "A",
      pasta: "Faculdade/Redes",
      conteudo: "texto",
      tags: ["Redes", "estudo"],
    });
  });

  it("aceita pasta null e vazia como raiz", () => {
    expect(esquemaDeCriacao.safeParse({ titulo: "A", pasta: null }).data?.pasta).toBeNull();
    expect(esquemaDeCriacao.safeParse({ titulo: "A", pasta: "  " }).data?.pasta).toBeNull();
  });

  it("limita a pasta em tamanho e profundidade, antes de qualquer trabalho com ela", () => {
    const funda = Array.from({ length: 21 }, () => "a").join("/");
    const enorme = Array.from({ length: 50_000 }, () => "a").join("/");

    expect(esquemaDeCriacao.safeParse({ titulo: "A", pasta: funda }).success).toBe(false);
    expect(esquemaDeCriacao.safeParse({ titulo: "A", pasta: enorme }).success).toBe(false);
    expect(esquemaDeCriacao.safeParse({ titulo: "A", pasta: "x".repeat(501) }).success).toBe(false);
    expect(esquemaDeCriacao.safeParse({ titulo: "A", pasta: Array.from({ length: 20 }, () => "a").join("/") }).success).toBe(true);
  });

  it.each([
    ["título ausente", {}],
    ["título vazio", { titulo: "  " }],
    ["título com barra", { titulo: "A/B" }],
    ["título que não é texto", { titulo: 3 }],
    ["conteúdo que não é texto", { titulo: "A", conteudo: 3 }],
    ["tags que não são lista", { titulo: "A", tags: "x" }],
    ["tags demais", { titulo: "A", tags: Array.from({ length: 31 }, (_, i) => `t${i}`) }],
  ])("recusa %s", (_nome, corpo) => {
    expect(esquemaDeCriacao.safeParse(corpo).success).toBe(false);
  });

  it("devolve a mensagem do título, pronta para mostrar", () => {
    const resultado = esquemaDeCriacao.safeParse({ titulo: "A|B" });

    expect(!resultado.success && resultado.error.issues[0].message).toMatch(/não pode conter/);
  });
});

describe("esquemaDeAtualizacao", () => {
  it("exige a revisão base e aceita só o que mudou", () => {
    expect(esquemaDeAtualizacao.safeParse({ revisaoBase: 3, conteudo: "novo" }).data).toEqual({
      revisaoBase: 3,
      conteudo: "novo",
    });
    expect(esquemaDeAtualizacao.safeParse({ conteudo: "novo" }).success).toBe(false);
  });

  it("aceita um checkpoint sem mudança de texto", () => {
    expect(esquemaDeAtualizacao.safeParse({ revisaoBase: 1, checkpoint: true }).data).toEqual({
      revisaoBase: 1,
      checkpoint: true,
    });
  });

  it("recusa revisão negativa ou fracionada", () => {
    expect(esquemaDeAtualizacao.safeParse({ revisaoBase: -1 }).success).toBe(false);
    expect(esquemaDeAtualizacao.safeParse({ revisaoBase: 1.5 }).success).toBe(false);
  });

  it("ignora campos que não conhece, em vez de repassá-los", () => {
    const resultado = esquemaDeAtualizacao.safeParse({ revisaoBase: 1, titulo: "não por aqui", id: "x" });

    expect(resultado.success && Object.keys(resultado.data)).toEqual(["revisaoBase"]);
  });
});

describe("esquemaDeRenomeacao", () => {
  it("valida o título novo", () => {
    expect(esquemaDeRenomeacao.safeParse({ revisaoBase: 1, titulo: " Novo " }).data).toEqual({
      revisaoBase: 1,
      titulo: "Novo",
    });
    expect(esquemaDeRenomeacao.safeParse({ revisaoBase: 1, titulo: "" }).success).toBe(false);
  });
});

describe("esquemaDeIdDeNota", () => {
  it.each(["12", "L0ZvbyI", "abc_DEF-123"])("aceita %s", (id) => {
    expect(esquemaDeIdDeNota.safeParse(id).success).toBe(true);
  });

  it.each(["", "a/b", "a:b", "../x", "a b", "x".repeat(1501)])("recusa %j", (id) => {
    expect(esquemaDeIdDeNota.safeParse(id).success).toBe(false);
  });
});

describe("esquemaDeBusca", () => {
  it("usa 10 resultados por padrão e converte o limite que vem como texto", () => {
    expect(esquemaDeBusca.safeParse({ q: " redes " }).data).toEqual({ q: "redes", limite: 10 });
    expect(esquemaDeBusca.safeParse({ q: "redes", limite: "5" }).data).toEqual({ q: "redes", limite: 5 });
  });

  it("recusa busca vazia, longa demais e limite fora de 1 a 50", () => {
    expect(esquemaDeBusca.safeParse({ q: "  " }).success).toBe(false);
    expect(esquemaDeBusca.safeParse({ q: "x".repeat(201) }).success).toBe(false);
    expect(esquemaDeBusca.safeParse({ q: "a", limite: "0" }).success).toBe(false);
    expect(esquemaDeBusca.safeParse({ q: "a", limite: "51" }).success).toBe(false);
    expect(esquemaDeBusca.safeParse({ q: "a", limite: "abc" }).success).toBe(false);
  });
});
