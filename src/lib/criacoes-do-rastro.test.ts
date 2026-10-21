import { describe, expect, it } from "vitest";
import { idsCriadosNoRastro } from "./criacoes-do-rastro";
import { iniciarRastro, registrarPasso } from "./rastro-do-agente";

describe("idsCriadosNoRastro", () => {
  it("sem rastro, ninguém foi criado", () => {
    expect(idsCriadosNoRastro(null).size).toBe(0);
  });

  it("junta só as escritas que criaram nota", () => {
    let rastro = iniciarRastro(0);
    rastro = registrarPasso(rastro, { tipo: "busca", ids: ["a"] }, 10);
    rastro = registrarPasso(rastro, { tipo: "leitura", id: "b" }, 20);
    rastro = registrarPasso(rastro, { tipo: "escrita", id: "c", criada: true }, 30);
    rastro = registrarPasso(rastro, { tipo: "escrita", id: "d", criada: false }, 40);

    expect([...idsCriadosNoRastro(rastro)]).toEqual(["c"]);
  });
});
