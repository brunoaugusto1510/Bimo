import { expect, it } from "vitest";
import { mesclarNotasLocais, podarNotasLocais } from "./notas-locais";
it("protege a nota de respostas anteriores à criação e adota lista iniciada depois", () => {
 const resumo = { id: "nova", titulo: "Nova", pasta: null };
 const locais = new Map([["nova", { resumo, criadoEm: 20 }]]);
 const base = new Map([["antiga", { ...resumo, id: "antiga" }]]);
 expect(mesclarNotasLocais(base, locais).has("nova")).toBe(true);
 expect(podarNotasLocais(locais, base, 10).has("nova")).toBe(true);
 expect(podarNotasLocais(locais, new Map([...base, ["nova", resumo]]), 21).size).toBe(0);
 expect(locais.size).toBe(1);
});
