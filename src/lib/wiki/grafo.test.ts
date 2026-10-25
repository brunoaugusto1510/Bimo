// @vitest-environment node
import { expect, it } from "vitest";
import { montarGrafoDeNotas } from "../grafo-de-notas";
import { CONFIGURACAO_PADRAO } from "../fisica-do-grafo";

it("marca neurônios por metadados e classifica só as arestas presentes no texto", () => {
  const nota = (id: string, titulo: string, conteudo: string) => ({ id, titulo, pasta: null, conteudo });
  const grafo = montarGrafoDeNotas({ configuracao: CONFIGURACAO_PADRAO,
    notas: [nota("1", "Origem", "[[Outra]]"), nota("2", "Outra", ""), nota("3", "Síntese A", "[[Origem]] [[Síntese B]]"), nota("4", "Síntese B", "")],
    sinteses: new Map([["3", { fontes: [{ id: "1" }, { id: "2" }] }], ["4", { fontes: [{ id: "2" }] }]]),
  });
  expect(grafo.nos.find((n) => n.id === "3")).toMatchObject({ tipo: "nota", neuronio: true });
  expect(grafo.nos.find((n) => n.id === "1")).not.toHaveProperty("neuronio");
  expect(grafo.arestas).toEqual([{ de: "1", para: "2", tipo: "notas" }, { de: "3", para: "1", tipo: "sinapse" }, { de: "3", para: "4", tipo: "neuronios" }]);
  expect(grafo.arestas).not.toContainEqual(expect.objectContaining({ de: "4", para: "2" }));
});
