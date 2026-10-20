import { describe, expect, it } from "vitest";
import { mesmasTags, normalizarTags } from "./tags-da-nota";

describe("normalizarTags", () => {
  it("tira o # e os espaços, descarta vazias e repetidas sem diferenciar maiúsculas", () => {
    expect(normalizarTags(["#a", "A", " b ", "", "#", "# c"])).toEqual(["a", "b", "c"]);
  });
  it("mantém a grafia da primeira ocorrência e a ordem", () => {
    expect(normalizarTags(["Ideia", "ideia", "Projeto"])).toEqual(["Ideia", "Projeto"]);
  });
});

describe("mesmasTags", () => {
  it("compara ordem e conteúdo sem diferenciar maiúsculas", () => {
    expect(mesmasTags(["A", "b"], ["a", "B"])).toBe(true);
    expect(mesmasTags(["a", "b"], ["b", "a"])).toBe(false);
    expect(mesmasTags(["a"], ["a", "b"])).toBe(false);
  });
});
