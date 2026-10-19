import { expect, it } from "vitest";
import { ESTADO_INICIAL, reduzir } from "./estado";
it("abre em edição na aba nova, vazia e na navegação", () => {
  for (const inicial of [ESTADO_INICIAL, reduzir(ESTADO_INICIAL, { tipo: "nova-aba-vazia" }), reduzir(ESTADO_INICIAL, { tipo: "abrir-nota", id: "antiga" })]) {
    const estado = reduzir(inicial, { tipo: "abrir-nota", id: "nova", modo: "edicao" });
    expect(estado.abas.find((aba) => aba.chave === estado.ativa)).toMatchObject({ modo: "edicao" });
  }
});
it("navegar na mesma aba preserva o modo de edição", () => {
 const anterior = reduzir(ESTADO_INICIAL, { tipo: "abrir-nota", id: "a", modo: "edicao" });
 const proximo = reduzir(anterior, { tipo: "abrir-nota", id: "b" });
 expect(proximo.abas[0]).toMatchObject({ modo: "edicao" });
});
it("lista vazia do servidor não fecha abas quando há nota local", () => {
 const estado = reduzir(ESTADO_INICIAL, { tipo: "abrir-nota", id: "servidor" });
 expect(reduzir(estado, { tipo: "descartar-inexistentes", existentes: new Set(), protegidos: new Set(["local"]) })).toBe(estado);
 const comLocal = reduzir(estado, { tipo: "abrir-nota", id: "local", novaAba: true });
 expect(reduzir(comLocal, { tipo: "descartar-inexistentes", existentes: new Set(["servidor"]), protegidos: new Set(["local"]) }).abas).toHaveLength(2);
});
