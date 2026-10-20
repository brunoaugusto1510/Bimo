import { describe, expect, it } from "vitest";
import { esquemaDeRascunho } from "./validacao-do-rascunho";

const pedido = { acao: "continuar", titulo: " Nota ", antes: " Texto ", depois: " ", trecho: "" };
describe("validação do rascunho", () => {
  it("apara todos os campos", () => {
    expect(esquemaDeRascunho.parse(pedido)).toEqual({ ...pedido, titulo: "Nota", antes: "Texto", depois: "" });
  });
  it.each([
    { acao: "apagar" }, { antes: " " }, { trecho: "seleção" },
    { titulo: "a".repeat(201) }, { antes: "a".repeat(4001) },
    { depois: "a".repeat(2001) }, { acao: "resumir", trecho: "a".repeat(8001) },
    { acao: "resumir", trecho: " " }, { acao: "melhorar", trecho: " " }, { antes: null },
  ])("recusa pedido inválido: %j", (mudancas) => {
    const resultado = esquemaDeRascunho.safeParse({ ...pedido, ...mudancas });
    expect(resultado.success).toBe(false);
    if (!resultado.success) expect(resultado.error.issues[0].message).not.toMatch(/Invalid|expected|Too big/);
  });
  it.each(["resumir", "melhorar"])("aceita %s com seleção e sem contexto", (acao) => {
    expect(esquemaDeRascunho.safeParse({ ...pedido, acao, antes: "", trecho: "trecho" }).success).toBe(true);
  });
});
