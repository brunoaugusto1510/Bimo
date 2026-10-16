import { expect, it } from "vitest";
import { resolverNotaDoAgente } from "./resolver-nota-do-agente";
import { criarRepositorioEmMemoria } from "./repositorio-de-notas/memoria";

it("prioriza caminho completo, detecta sufixos ambíguos e não resolve entrada vazia", async () => {
  const repo = criarRepositorioEmMemoria([{ titulo: "TCP", pasta: "Redes" }, { titulo: "TCP", pasta: "Estudos/Redes" }]);
  const notas = await repo.listarResumos();
  expect(resolverNotaDoAgente("Redes/TCP.md", notas)?.id).toBe(notas[0].id);
  expect(() => resolverNotaDoAgente("tcp", notas)).toThrow(/caminho completo/);
  expect(resolverNotaDoAgente("", notas)).toBeNull();
  expect(resolverNotaDoAgente("ausente", notas)).toBeNull();
});

it.each(["ESTUDOS / matemática / ÁLGEBRA.MD", "/estudos/matematica/algebra", "Estudos\\Matemática\\Álgebra.md"])("normaliza acentos, caixa, barras e segmentos: %s", async (entrada) => {
  const notas = await criarRepositorioEmMemoria([{ pasta: "Estudos/Matemática", titulo: "Álgebra" }]).listarResumos();
  expect(resolverNotaDoAgente(entrada, notas)?.id).toBe(notas[0].id);
});
it("prefere caminho exato antes de remover acentos e caixa", () => {
  const base = { tags: [], criadoEm: null, atualizadoEm: null, revisao: 0 };
  const notas = [
    { ...base, id: "1", pasta: "Estudos", titulo: "Álgebra" },
    { ...base, id: "2", pasta: "Estudos", titulo: "Algebra" },
    { ...base, id: "3", pasta: "Redes", titulo: "TCP" },
    { ...base, id: "4", pasta: "redes", titulo: "tcp" },
  ];
  for (const nota of notas) expect(resolverNotaDoAgente(`${nota.pasta}/${nota.titulo}.md`, notas)?.id).toBe(nota.id);
});
it("recusa sufixo ambíguo e limita a dez candidatos", async () => {
  const notas = await criarRepositorioEmMemoria(Array.from({ length: 12 }, (_, i) => ({ pasta: `P${i}/Redes`, titulo: "TCP" }))).listarResumos();
  expect(() => resolverNotaDoAgente("Redes/TCP", notas)).toThrow(/e mais 2/);
  try { resolverNotaDoAgente("Redes/TCP", notas); } catch (erro) {
    expect(String(erro).match(/\.md/g)).toHaveLength(10);
  }
});
