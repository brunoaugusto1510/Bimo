// @vitest-environment node
/** Regressões da revisão geral da Wiki Viva: cada teste reproduz uma falha encontrada antes da correção. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("../repositorio-de-notas", () => ({ obterRepositorio: vi.fn() }));
vi.mock("./agendar", () => ({ agendarManutencaoWiki: vi.fn() }));
import { obterRepositorio } from "../repositorio-de-notas";
import { criarRepositorioEmMemoria } from "../repositorio-de-notas/memoria";
import { criarTokenDeSessao, NOME_DO_COOKIE } from "../sessao";
import { GET as cerebro } from "../../app/api/wiki/cerebro/route";
import { processarWiki } from "./automacao";
import type { GeradorAutomaticoWiki } from "./automacao-tipos";
import { processarLoteWiki } from "./lote";

beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-26T12:00:00Z"));
  vi.stubEnv("SEGREDO_SESSAO", "segredo-ficticio-de-sessao-com-mais-de-32-caracteres");
  vi.spyOn(console, "error").mockImplementation(() => {}); vi.spyOn(console, "info").mockImplementation(() => {});
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

function preparar(quantidade: number) {
  const repo = criarRepositorioEmMemoria(Array.from({ length: quantidade }, (_, n) => ({ titulo: `Nota ${n}`, conteudo: `Informação pessoal ${n}.` })));
  vi.advanceTimersByTime(91_000);
  return repo;
}
const conservar = { politica: "rede-v5", semPublicacao: { decisao: "conservar_origem", motivo: "Só uma anotação sem conhecimento a sintetizar.", condicao: null, tipoDePendencia: null, neuroniosALer: [] }, propostas: [] };
const adiar = { politica: "rede-v5", semPublicacao: { decisao: "adiar", motivo: "Falta contexto para decidir sobre esta nota.", condicao: "Quando houver uma nota relacionada.", tipoDePendencia: "contexto_da_origem", neuroniosALer: [] }, propostas: [] };

describe("orçamento diário e falhas do provedor", () => {
  it("erro 5xx do provedor não consome o teto do dia: nada foi gerado nem cobrado", async () => {
    const repo = preparar(3);
    const gerar = vi.fn<GeradorAutomaticoWiki>().mockRejectedValue(Object.assign(new Error("indisponível"), { status: 503 }));
    expect(await processarWiki(repo, gerar, { tetoDiario: 200_000 })).toMatchObject({ tipo: "adiado", motivo: "temporario" });
    expect((await repo.wiki!.automacao!.energia(200_000)).utilizada).toBe(0);
  });

  it("falha de rede (sem resposta) segue contando a reserva: a chamada pode ter sido cobrada", async () => {
    const repo = preparar(3);
    const gerar = vi.fn<GeradorAutomaticoWiki>().mockRejectedValue(new Error("Falha de conexão"));
    await processarWiki(repo, gerar, { tetoDiario: 200_000 });
    expect((await repo.wiki!.automacao!.energia(200_000)).utilizada).toBeGreaterThan(0);
  });
});

describe("lote e verificação das sínteses", () => {
  it("uma nota adiada por decisão editorial não encerra o lote: a próxima nota pronta é lida", async () => {
    const repo = preparar(3);
    const gerar = vi.fn<GeradorAutomaticoWiki>()
      .mockResolvedValueOnce({ proposta: adiar, uso: { entrada: 100, saida: 20 } })
      .mockResolvedValue({ proposta: conservar, uso: { entrada: 100, saida: 20 } });
    const resultado = await processarLoteWiki(repo, gerar, { tetoDiario: 200_000 });
    expect(gerar).toHaveBeenCalledTimes(3);
    expect(resultado.lote).toMatchObject({ processados: 2, parada: "ocioso" });
  });

  it("falha do provedor (temporária) ainda encerra o lote: insistir só gastaria tentativas de outras notas", async () => {
    const repo = preparar(3);
    const gerar = vi.fn<GeradorAutomaticoWiki>().mockRejectedValue(Object.assign(new Error("indisponível"), { status: 503 }));
    const resultado = await processarLoteWiki(repo, gerar, { tetoDiario: 200_000 });
    expect(gerar).toHaveBeenCalledTimes(1);
    expect(resultado.lote).toMatchObject({ processados: 0, parada: "adiado" });
  });

  it("a verificação local das sínteses é feita uma vez por lote, não a cada rodada", async () => {
    const repo = preparar(4);
    const listar = vi.spyOn(repo.wiki!, "listar");
    const gerar = vi.fn<GeradorAutomaticoWiki>().mockResolvedValue({ proposta: conservar, uso: { entrada: 100, saida: 20 } });
    await processarLoteWiki(repo, gerar, { tetoDiario: 200_000 });
    expect(gerar).toHaveBeenCalledTimes(4);
    // `listar` só é chamado pela verificação (uma vez) e pela recuperação de contexto de cada rodada; a verificação não se repete.
    const chamadasDaVerificacao = listar.mock.calls.length - 4;
    expect(chamadasDaVerificacao).toBeLessThanOrEqual(1);
  });

  it("uma falha na verificação local não impede a leitura das notas", async () => {
    const repo = preparar(2);
    vi.spyOn(repo.wiki!, "listar").mockRejectedValueOnce(new Error("falha na verificação"));
    const gerar = vi.fn<GeradorAutomaticoWiki>().mockResolvedValue({ proposta: conservar, uso: { entrada: 100, saida: 20 } });
    expect(await processarWiki(repo, gerar, { tetoDiario: 200_000 })).toMatchObject({ tipo: "processado" });
    expect(gerar).toHaveBeenCalledTimes(1);
  });
});

describe("Cérebro com configuração inválida", () => {
  it("um limite de energia inválido não derruba a tela: a energia fica indisponível e o resto aparece", async () => {
    vi.stubEnv("WIKI_TETO_TOKENS_DIA", "");
    vi.mocked(obterRepositorio).mockResolvedValue(criarRepositorioEmMemoria());
    const r = await cerebro(new Request("https://bimo.local/api/wiki/cerebro", { headers: { cookie: `${NOME_DO_COOKIE}=${criarTokenDeSessao()}` } }));
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ resumo: { neuronios: 0 }, energia: null });
  });
});
