import { afterEach, expect, it, vi } from "vitest";
import { buscarNota, criarNota, renomearNota, semearNota } from "./cliente-de-notas";
afterEach(() => vi.unstubAllGlobals());
it("devolve a nota criada e preserva colisão e motivo", async () => {
 const fetch = vi.fn().mockResolvedValueOnce(Response.json({ nota: { id: "nova" }, capacidades: { escrita: true } }, { status: 201 })).mockResolvedValueOnce(Response.json({ tipo: "titulo-em-uso", idExistente: "outra" }, { status: 409 })).mockResolvedValueOnce(Response.json({ erro: "Título inválido" }, { status: 400 }));
 vi.stubGlobal("fetch", fetch);
 expect(await criarNota({ titulo: "Nova" })).toMatchObject({ tipo: "ok", nota: { id: "nova" } });
 expect(await criarNota({ titulo: "Nova" })).toEqual({ tipo: "titulo-em-uso", idExistente: "outra" });
 expect(await criarNota({ titulo: "#" })).toEqual({ tipo: "erro", mensagem: "Título inválido" });
});
it("consome a semente uma vez, sem GET inicial", async () => {
 const resposta = { nota: { id: "semente" }, capacidades: { escrita: true, datas: true } } as Parameters<typeof semearNota>[0];
 const fetch = vi.fn().mockResolvedValue(Response.json(resposta)); vi.stubGlobal("fetch", fetch);
 semearNota(resposta);
 expect(await buscarNota("semente")).toEqual(resposta); expect(fetch).not.toHaveBeenCalled();
 await buscarNota("semente"); expect(fetch).toHaveBeenCalledTimes(1);
});
it("renomeia com revisão e preserva conflito", async () => {
 const fetch = vi.fn().mockResolvedValue(Response.json({ tipo: "conflito", atual: { revisao: 4 } }, { status: 409 })); vi.stubGlobal("fetch", fetch);
 expect(await renomearNota("id", "Novo", 3)).toMatchObject({ tipo: "conflito", atual: { revisao: 4 } });
 expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ titulo: "Novo", revisaoBase: 3 });
});
it("403 genérico não é classificado como somente leitura", async () => {
 const fetch = vi.fn().mockResolvedValue(Response.json({ erro: "Recusado por outro motivo" }, { status: 403 }));
 vi.stubGlobal("fetch", fetch);
 expect(await criarNota({ titulo: "Nova" })).toEqual({ tipo: "erro", mensagem: "Recusado por outro motivo" });
});
