// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { criarRepositorioEmMemoria } from "../repositorio-de-notas/memoria";
import { processarWiki } from "./automacao";
import type { GeradorAutomaticoWiki } from "./automacao-tipos";
import { ESTABILIDADE_DA_WIKI_SEGUNDOS } from "./configuracao";
import { estadoDaPagina, exigirWiki, obterIndiceWiki } from "./servico";
import { hashDoConteudo } from "./fontes";

const autor = { criadoPor: "usuario" as const };
const sintetizar: GeradorAutomaticoWiki = async (c) => ({ proposta: { propostas: [{ titulo: "Consistência", alvoId: null, aliases: ["cache"], lacunas: [],
  afirmacoes: [{ texto: "Cópias divergem.", natureza: "explicita", evidencias: [{ fonteId: c.origem.id, citacao: "O cache guarda cópias locais" }] }] }] }, uso: { entrada: 1, saida: 1 } });

async function preparar() {
  const repo = criarRepositorioEmMemoria([{ titulo: "Cache", conteudo: "O cache guarda cópias locais." }]);
  vi.advanceTimersByTime((ESTABILIDADE_DA_WIKI_SEGUNDOS + 1) * 1000);
  await processarWiki(repo, sintetizar, { tetoDiario: 200_000 });
  return repo;
}
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-22T12:00:00Z")); });
afterEach(() => vi.useRealTimers());

describe("índice e estado das sínteses", () => {
  it("lista cada síntese com seu estado e as origens", async () => {
    const repo = await preparar();
    const [pagina] = await obterIndiceWiki(repo);
    expect(pagina).toMatchObject({ titulo: "Consistência", estado: "atualizada", fontes: 1, origens: ["1"] });
  });

  it("avisa quando a origem mudou e quando o texto da síntese foi editado à mão", async () => {
    const repo = await preparar();
    const [pagina] = await obterIndiceWiki(repo);
    await repo.atualizarNota("1", { conteudo: "O cache guarda cópias remotas." }, { revisaoBase: 1, autor });
    expect((await obterIndiceWiki(repo))[0].estado).toBe("desatualizada");
    await repo.atualizarNota(pagina.id, { conteudo: "minha versão" }, { revisaoBase: 1, autor });
    expect((await obterIndiceWiki(repo))[0].estado).toBe("edicao_manual");
  });

  it("renomear a origem não desatualiza a síntese", async () => {
    const repo = await preparar();
    await repo.renomearNota("1", "Cache local", { revisaoBase: 1, autor });
    expect((await obterIndiceWiki(repo))[0].estado).toBe("atualizada");
  });

  it("origem removida deixa a síntese desatualizada e nota ausente a deixa indisponível", async () => {
    const repo = await preparar();
    const [meta] = await repo.wiki!.listar();
    const semOrigem = { ...repo, obterNota: async (id: string) => (id === "1" ? null : repo.obterNota(id)) };
    expect(await estadoDaPagina(semOrigem, meta)).toBe("desatualizada");
    const semNada = { ...repo, obterNota: async () => null };
    expect(await estadoDaPagina(semNada, meta)).toBe("indisponivel");
  });

  it("isola o índice por repositório e devolve cópias dos snapshots", async () => {
    const repo = await preparar();
    expect(await obterIndiceWiki(criarRepositorioEmMemoria())).toEqual([]);
    const [meta] = await repo.wiki!.listar();
    meta.fontes[0].titulo = "adulterado"; meta.afirmacoes.length = 0;
    const [deNovo] = await repo.wiki!.listar();
    expect(deNovo.fontes[0]).toMatchObject({ titulo: "Cache", hash: hashDoConteudo("O cache guarda cópias locais.") });
    expect(deNovo.fontes[0]).not.toHaveProperty("conteudo");
    expect(deNovo.afirmacoes).toHaveLength(1);
  });

  it("sem a wiki habilitada, responde 503", () => {
    const repo = { ...criarRepositorioEmMemoria(), wiki: undefined };
    expect(() => exigirWiki(repo)).toThrowError(expect.objectContaining({ status: 503 }));
  });
});
