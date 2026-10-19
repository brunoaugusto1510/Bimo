import { describe, expect, it } from "vitest";
import { analisarPedidoDeCriacao, pedidoDaLigacao, proximoTituloLivre } from "./nota-nova";
const notas = [{ id: "1", titulo: "SEM TITULO", pasta: "A" }, { id: "2", titulo: "Sem título 1", pasta: "A" }];
describe("nota nova", () => {
  it("numera apenas na pasta de destino, sem caixa e acento", () => {
    expect(proximoTituloLivre("A", notas)).toBe("Sem título 2");
    expect(proximoTituloLivre(null, notas)).toBe("Sem título");
  });
  it("separa o caminho a partir da raiz e oferece abrir repetida", () => {
    expect(analisarPedidoDeCriacao("A/sem título", "Outra", notas)).toMatchObject({ tipo: "existente", id: "1" });
    expect(analisarPedidoDeCriacao("B/Nova", "Outra", notas)).toEqual({ tipo: "criar", titulo: "Nova", pasta: "B" });
    expect(analisarPedidoDeCriacao("inválido#", null, notas)).toMatchObject({ tipo: "invalido", motivo: expect.any(String) });
  });
  it("preserva pasta de ligação explícita e herda origem nas simples", () => {
    expect(pedidoDaLigacao("P/x", "Origem")).toEqual({ titulo: "x", pasta: "P" });
    expect(pedidoDaLigacao("x", "Origem")).toEqual({ titulo: "x", pasta: "Origem" });
  });
});
