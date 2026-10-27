// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { criarRepositorioEmMemoria } from "../repositorio-de-notas/memoria";
import { processarWiki } from "./automacao";
import type { ContextoWiki, GeradorAutomaticoWiki } from "./automacao-tipos";
import { consultarConhecimentoWiki } from "./consulta";
import { ESTABILIDADE_DA_WIKI_SEGUNDOS } from "./configuracao";

const ESPERA = (ESTABILIDADE_DA_WIKI_SEGUNDOS + 1) * 1000;

const autor = { criadoPor: "usuario" as const };
const resposta = (contexto: ContextoWiki, alvoId: string | null = null) => ({ proposta: { propostas: [{
  titulo: "Consistência entre cópias", alvoId, aliases: ["cache", "sincronização"],
  afirmacoes: [{ texto: "As cópias precisam de uma política de atualização.", natureza: "inferencia",
    evidencias: [{ fonteId: contexto.origem.id, citacao: contexto.trecho.texto }] }], lacunas: [],
}] }, uso: { entrada: 200, saida: 100 } });
const rodar = (repo: ReturnType<typeof criarRepositorioEmMemoria>, gerar: GeradorAutomaticoWiki) => processarWiki(repo, gerar, { tetoDiario: 200_000 });
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-22T12:00:00Z")); });
afterEach(() => vi.useRealTimers());

describe("Wiki Viva integrada", () => {
  it("descobre uma síntese pesquisável sem alterar a origem nem exigir página ou seleção", async () => {
    const repo = criarRepositorioEmMemoria();
    const original = await repo.criarNota({ titulo: "Minha experiência", conteudo: "O cache ficou desatualizado." }, autor);
    vi.advanceTimersByTime(ESPERA);
    const gerar = vi.fn<GeradorAutomaticoWiki>().mockImplementation(async (c) => resposta(c));
    expect((await rodar(repo, gerar)).tipo).toBe("processado");
    const [pagina] = await repo.wiki!.listar();
    expect((await repo.obterNota(pagina.notaId))?.pasta).toBe("Neurônios");
    expect(await repo.obterNota("1")).toEqual(original.tipo === "ok" ? original.nota : null);
    expect(pagina.afirmacoes[0].evidencias[0]).toMatchObject({ fonteId: "1", inicio: 0 });
    expect(await repo.buscarPorConteudo("Consistência", 8)).toHaveLength(1);
    expect((await rodar(repo, gerar)).tipo).toBe("ocioso");
    expect(gerar).toHaveBeenCalledTimes(1);
  });
  it("enriquece a mesma identidade com novas notas e não realimenta a fila com derivados", async () => {
    const repo = criarRepositorioEmMemoria([{ titulo: "Cache", conteudo: "O cache contém cópias." }]);
    vi.advanceTimersByTime(ESPERA);
    await rodar(repo, async (c) => resposta(c));
    const [pagina] = await repo.wiki!.listar();
    await repo.criarNota({ titulo: "Offline", conteudo: "Alterações offline precisam ser sincronizadas." }, autor);
    vi.advanceTimersByTime(ESPERA);
    await rodar(repo, async (c) => resposta(c, pagina.notaId));
    expect(await repo.wiki!.listar()).toHaveLength(1);
    expect((await repo.obterNota(pagina.notaId))?.revisao).toBe(2);
    expect((await repo.wiki!.obter(pagina.notaId))?.fontes.map((f) => f.id)).toEqual(["3", "1"]);
    expect((await rodar(repo, async (c) => resposta(c))).tipo).toBe("ocioso");
  });
  it("agrupa autosaves e rejeita resultado cuja origem mudou durante a geração", async () => {
    const repo = criarRepositorioEmMemoria([{ titulo: "A", conteudo: "versão um" }]);
    await repo.atualizarNota("1", { conteudo: "versão dois" }, { revisaoBase: 1, autor });
    expect((await rodar(repo, async (c) => resposta(c))).tipo).toBe("ocioso");
    vi.advanceTimersByTime(ESPERA);
    await rodar(repo, async (c) => {
      expect(c.origem.revisao).toBe(2);
      await repo.atualizarNota("1", { conteudo: "versão três" }, { revisaoBase: 2, autor });
      return resposta(c);
    });
    expect(await repo.wiki!.listar()).toHaveLength(0);
    vi.advanceTimersByTime(ESPERA);
    await rodar(repo, async (c) => resposta(c));
    expect((await repo.wiki!.listar())[0].fontes[0].revisao).toBe(3);
  });
  it("preserva edição manual e descarta só a proposta com citação inventada", async () => {
    const repo = criarRepositorioEmMemoria([{ titulo: "A", conteudo: "evidência real" }]);
    vi.advanceTimersByTime(ESPERA);
    await rodar(repo, async (c) => resposta(c));
    const [pagina] = await repo.wiki!.listar();
    await repo.atualizarNota(pagina.notaId, { conteudo: "minha edição" }, { revisaoBase: 1, autor });
    await repo.criarNota({ titulo: "B", conteudo: "outra evidência" }, autor);
    vi.advanceTimersByTime(ESPERA);
    await rodar(repo, async (c) => resposta(c, pagina.notaId));
    expect((await repo.obterNota(pagina.notaId))?.conteudo).toBe("minha edição");
    const isolado = criarRepositorioEmMemoria([{ titulo: "A", conteudo: "real" }]);
    vi.advanceTimersByTime(ESPERA);
    await rodar(isolado, async (c) => {
      const r = resposta(c); r.proposta.propostas.push({ ...r.proposta.propostas[0], titulo: "Outra",
        afirmacoes: [{ texto: "Sem suporte", natureza: "inferencia", evidencias: [{ fonteId: "1", citacao: "fabricada" }] }] });
      return r;
    });
    const publicadas = await isolado.wiki!.listar();
    expect(publicadas).toHaveLength(1);
    expect((await isolado.obterNota(publicadas[0].notaId))?.titulo).toBe("Consistência entre cópias");
  });
  it("orçamento negado impede a chamada e falha incerta mantém reserva", async () => {
    const repo = criarRepositorioEmMemoria([{ titulo: "A", conteudo: "real" }]);
    vi.advanceTimersByTime(ESPERA);
    const gerar = vi.fn<GeradorAutomaticoWiki>().mockRejectedValue(new Error("falha"));
    expect((await processarWiki(repo, gerar, { tetoDiario: 1 })).tipo).toBe("orcamento");
    expect(gerar).not.toHaveBeenCalled();
    vi.advanceTimersByTime(86_400_001);
    const trabalho = await repo.wiki!.automacao!.reivindicar();
    expect(trabalho).not.toBeNull();
    const fila = repo.wiki!.automacao!;
    const reserva = await fila.reservar(trabalho!, 100, 100);
    await fila.confirmarConsumo(reserva!, null);
    expect(await fila.reservar(trabalho!, 1, 100)).toBeNull();
  });
  it("processa texto grande até o fim e aceita nenhuma mudança sem criar nota vazia", async () => {
    const repo = criarRepositorioEmMemoria([{ titulo: "Longa", conteudo: "a".repeat(17_001) }]);
    vi.advanceTimersByTime(ESPERA);
    const trechos: string[] = [];
    for (let i = 0; i < 3; i++) await rodar(repo, async (c) => { trechos.push(c.trecho.texto); return { proposta: { propostas: [] }, uso: null }; });
    expect(trechos.join("")).toBe("a".repeat(17_001));
    expect((await repo.wiki!.automacao!.cobertura()).concluidos).toBe(1);
    expect(await repo.wiki!.listar()).toHaveLength(0);
  });
  it("uma síntese mais abrangente aponta às raízes pessoais, sem contar a wiki como nova fonte", async () => {
    const repo = criarRepositorioEmMemoria([{ titulo: "Cache", conteudo: "O cache contém cópias." }]);
    vi.advanceTimersByTime(ESPERA); await rodar(repo, async (c) => resposta(c));
    await repo.criarNota({ titulo: "Cópias offline", conteudo: "A edição offline exige sincronização." }, autor);
    vi.advanceTimersByTime(ESPERA);
    await rodar(repo, async (c) => {
      expect(c.candidatas.some((p) => p.metadados)).toBe(true);
      const r = resposta(c); r.proposta.propostas[0].titulo = "Coordenação em sistemas distribuídos";
      r.proposta.propostas[0].afirmacoes[0].evidencias.push({ fonteId: "1", citacao: "O cache contém cópias" }); return r;
    });
    const pagina = (await repo.wiki!.listar()).find((p) => p.notaId !== "2")!;
    expect(pagina.fontes.map((f) => f.id)).toEqual(["3", "1"]);
    expect(pagina.fontes.some((f) => f.id === "2")).toBe(false);
  });
  it("busca por alias traz evidências e uma origem alterada impede apresentar a síntese como atual", async () => {
    const repo = criarRepositorioEmMemoria([{ titulo: "A", conteudo: "Cópias locais." }]);
    vi.advanceTimersByTime(ESPERA); await rodar(repo, async (c) => resposta(c));
    const pacote = await consultarConhecimentoWiki(repo, "sincronização", []);
    expect(pacote?.notas[0]).toMatchObject({ estado: "atualizada", afirmacoes: [{ evidencias: [{ caminho: "A.md", revisao: 1 }] }] });
    await repo.atualizarNota("1", { conteudo: "Texto corrigido." }, { revisaoBase: 1, autor });
    const atual = await consultarConhecimentoWiki(repo, "sincronização", []);
    expect(atual?.notas[0]).not.toHaveProperty("sintese");
    expect(atual?.notas[0].afirmacoes).toEqual([]);
    const semAcesso = { ...repo, obterNota: vi.fn(async (id: string) => id === "1" ? null : repo.obterNota(id)) };
    // Sem nenhuma origem acessível, a síntese fica fora das respostas (como a tela promete), em vez de vir vazia.
    expect((await consultarConhecimentoWiki(semAcesso, "sincronização", []))?.notas).toEqual([]);
  });
  it("limita recuperação de posse abandonada e interrompe toda a fila após falha de autenticação", async () => {
    const repo = criarRepositorioEmMemoria([{ titulo: "A", conteudo: "texto" }]); const fila = repo.wiki!.automacao!;
    vi.advanceTimersByTime(ESPERA);
    for (let i = 0; i < 3; i++) { expect(await fila.reivindicar()).not.toBeNull(); vi.advanceTimersByTime(121_000); }
    expect(await fila.reivindicar()).toBeNull();
    await fila.retomar();
    const t = (await fila.reivindicar())!; await fila.falhar(t, "configuracao");
    await repo.criarNota({ titulo: "B", conteudo: "outra" }, autor); vi.advanceTimersByTime(ESPERA);
    expect(await fila.reivindicar()).toBeNull();
    await fila.retomar(); expect(await fila.reivindicar()).not.toBeNull();
  });
  it("entrega as dependentes desatualizadas ao modelo e conclui a origem numa única chamada", async () => {
    const repo = criarRepositorioEmMemoria([{ titulo: "Cache", conteudo: "cópias locais" }]);
    vi.advanceTimersByTime(ESPERA);
    await rodar(repo, async (c) => { const r = resposta(c); r.proposta.propostas = ["Consistência", "Atualização", "Coordenação"].map((titulo) => ({ ...r.proposta.propostas[0], titulo })); return r; });
    await repo.atualizarNota("1", { conteudo: "cópias remotas" }, { revisaoBase: 1, autor }); vi.advanceTimersByTime(ESPERA);
    const gerar = vi.fn<GeradorAutomaticoWiki>(async (c) => {
      const dependentes = c.candidatas.filter((p) => p.conceito?.origens["1"] === 1);
      expect(dependentes).toHaveLength(3);
      const r = resposta(c);
      r.proposta.propostas = dependentes.map((p) => ({ ...resposta(c, p.nota.id).proposta.propostas[0], titulo: p.nota.titulo }));
      return r;
    });
    await rodar(repo, gerar);
    expect(gerar).toHaveBeenCalledTimes(1);
    expect((await repo.wiki!.automacao!.cobertura()).concluidos).toBe(1);
    expect((await repo.wiki!.listar()).every((p) => p.fontes[0].revisao === 2)).toBe(true);
  });
  it("retomar processamento não remove proteção editorial; retomar gerenciamento exige revisão atual", async () => {
    const repo = criarRepositorioEmMemoria([{ titulo: "A", conteudo: "texto" }]); vi.advanceTimersByTime(ESPERA);
    await rodar(repo, async (c) => resposta(c)); const [pagina] = await repo.wiki!.listar(); const fila = repo.wiki!.automacao!;
    await repo.atualizarNota(pagina.notaId, { conteudo: "texto pessoal" }, { revisaoBase: 1, autor });
    await fila.retomar(); expect((await fila.conceitos())[0].protegida).toBe(true);
    expect(await fila.gerenciar(pagina.notaId, 1, true)).toBe("conflito");
    expect(await fila.gerenciar(pagina.notaId, 2, true)).toBe("ok");
    expect((await fila.conceitos())[0].protegida).toBe(false);
    expect((await fila.cobertura()).pendentes).toBe(1);
  });
  it("indisponibilidade do provedor é transitória; autenticação inválida interrompe a integração", async () => {
    for (const [status, motivo] of [[503, "temporario"], [401, "configuracao"]] as const) {
      const repo = criarRepositorioEmMemoria([{ titulo: "A", conteudo: "texto" }]); vi.advanceTimersByTime(ESPERA);
      expect(await rodar(repo, async () => { throw Object.assign(new Error("falha simulada"), { status }); })).toEqual({ tipo: "adiado", motivo });
    }
  });
});
