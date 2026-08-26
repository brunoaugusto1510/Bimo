import type { Nota } from "@/dados/tipos";
import type { ServicoVault } from "../contratos";
import { notas as notasIniciais } from "@/dados/fixtures/notas";
import { arestas } from "@/dados/fixtures/arestas";
import { atraso } from "./atraso";

let notasEmMemoria: Nota[] = notasIniciais.map((nota) => ({ ...nota }));

export const servicoVaultFake: ServicoVault = {
  async listarNotas() {
    await atraso(120);
    return notasEmMemoria.map((nota) => ({ ...nota }));
  },

  async obterNota(id) {
    await atraso(80);
    const nota = notasEmMemoria.find((candidata) => candidata.id === id);
    if (!nota) throw new Error("Nota não encontrada");
    return { ...nota };
  },

  async listarArestas() {
    await atraso(120);
    return arestas.map((aresta) => ({ ...aresta }));
  },

  async salvarNota(nota) {
    await atraso(200);
    const indice = notasEmMemoria.findIndex((candidata) => candidata.id === nota.id);
    if (indice === -1) notasEmMemoria = [...notasEmMemoria, { ...nota }];
    else notasEmMemoria = notasEmMemoria.map((candidata, i) => (i === indice ? { ...nota } : candidata));
  },
};
