// @vitest-environment node
import { expect, it } from "vitest";
import { caminhoParaLigacao } from "../caminho-da-nota";
import { criarResolvedor, extrairLigacoes } from "../ligacoes";
import { planejarMudanca } from "../repositorio-de-notas/renomeacao";

it("uma referência explícita à raiz não escolhe uma homônima na pasta do neurônio", () => {
  const raiz = { id: "1", titulo: "Resumo", pasta: null };
  const resolver = criarResolvedor([raiz, { id: "2", titulo: "Resumo", pasta: "Neurônios" }]);
  expect(resolver(caminhoParaLigacao(null, "Resumo"), "Neurônios")).toEqual({ tipo: "resolvida", nota: raiz });
});
it("uma referência absoluta antiga com percentual literal continua legível", () => {
  const nota = { id: "1", titulo: "100%", pasta: null };
  expect(criarResolvedor([nota])("/100%", null)).toEqual({ tipo: "resolvida", nota });
});
it("pastas existentes com caracteres de wikilink continuam citáveis, inclusive após mover", () => {
  const origem = { id: "1", titulo: "Título 100%", pasta: "Projetos/[A] #1|^", conteudo: "" };
  const caminho = caminhoParaLigacao(origem.pasta, origem.titulo);
  const texto = `Veja [[${caminho}]].`;
  const [link] = extrairLigacoes(texto);
  expect(link).toBeDefined();
  expect(criarResolvedor([origem])(link.alvo, null)).toEqual({ tipo: "resolvida", nota: origem });
  const mudancas = planejarMudanca([origem, { id: "2", titulo: "Síntese", pasta: "Neurônios", conteudo: texto }], "1", { pasta: null });
  const [novo] = extrairLigacoes(mudancas[0].conteudo);
  expect(criarResolvedor([{ ...origem, pasta: null }])(novo.alvo, null).tipo).toBe("resolvida");
});
