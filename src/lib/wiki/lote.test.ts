// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { criarRepositorioEmMemoria } from "../repositorio-de-notas/memoria";
import type { GeradorAutomaticoWiki } from "./automacao-tipos";
import { processarLoteWiki } from "./lote";

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-25T12:00:00Z")); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

function preparar(quantidade: number) {
  const repo = criarRepositorioEmMemoria(Array.from({ length: quantidade }, (_, n) => ({ titulo: `Nota ${n}`, conteudo: `Informação pessoal ${n}.` })));
  vi.advanceTimersByTime(91_000);
  const gerar = vi.fn<GeradorAutomaticoWiki>().mockResolvedValue({ proposta: { propostas: [] }, uso: { entrada: 100, saida: 20 } });
  return { repo, gerar };
}

it("uma execução percorre várias notas, preserva as origens e para quando não há trabalho pronto", async () => {
  const { repo, gerar } = preparar(12);
  const antes = await repo.listarComConteudo();
  const resultado = await processarLoteWiki(repo, gerar, { tetoDiario: 200_000 });
  expect(resultado).toMatchObject({ tipo: "ocioso", lote: { processados: 12, publicadas: 0, parada: "ocioso" } });
  expect(gerar).toHaveBeenCalledTimes(12);
  expect(await repo.wiki!.automacao!.cobertura()).toMatchObject({ concluidos: 12, pendentes: 0 });
  expect(await repo.listarComConteudo()).toEqual(antes);
});

it("retoma do progresso persistido em lotes seguintes sem reler notas concluídas", async () => {
  const { repo, gerar } = preparar(8);
  const opcoes = { tetoDiario: 200_000, maxRodadas: 3 };
  expect((await processarLoteWiki(repo, gerar, opcoes)).lote).toMatchObject({ processados: 3, parada: "rodadas" });
  expect((await processarLoteWiki(repo, gerar, opcoes)).lote.processados).toBe(3);
  expect((await processarLoteWiki(repo, gerar, opcoes)).lote.processados).toBe(2);
  expect(new Set(gerar.mock.calls.map(([contexto]) => contexto.origem.id)).size).toBe(8);
  expect(await repo.wiki!.automacao!.cobertura()).toMatchObject({ concluidos: 8, pendentes: 0 });
});

it("um acervo de 389 notas avança até 25 rodadas por execução sem ser declarado totalmente lido", async () => {
  const { repo, gerar } = preparar(389);
  const resultado = await processarLoteWiki(repo, gerar, { tetoDiario: 200_000 });
  expect(resultado.lote).toMatchObject({ rodadas: 25, processados: 25, parada: "rodadas" });
  expect(await repo.wiki!.automacao!.cobertura()).toMatchObject({ elegiveis: 389, concluidos: 25, pendentes: 364 });
  expect(gerar).toHaveBeenCalledTimes(25);
});

it("interrompe no orçamento diário sem ampliar o teto nem chamar o modelo para a próxima nota", async () => {
  const { repo, gerar } = preparar(3);
  gerar.mockResolvedValue({ proposta: { propostas: [] }, uso: { entrada: 10_000, saida: 500 } });
  const resultado = await processarLoteWiki(repo, gerar, { tetoDiario: 20_000 });
  expect(resultado).toMatchObject({ tipo: "orcamento", lote: { processados: 1, parada: "orcamento" } });
  expect(gerar).toHaveBeenCalledTimes(1);
  expect(await repo.wiki!.automacao!.cobertura()).toMatchObject({ concluidos: 1, pendentes: 2 });
});

it("reserva tempo para concluir a última rodada em vez de iniciar outra perto do limite", async () => {
  const { repo, gerar } = preparar(8);
  gerar.mockImplementation(async () => {
    vi.setSystemTime(Date.now() + 70_000);
    return { proposta: { propostas: [] }, uso: { entrada: 100, saida: 20 } };
  });
  const resultado = await processarLoteWiki(repo, gerar, { tetoDiario: 200_000 });
  expect(resultado.lote).toMatchObject({ processados: 3, parada: "tempo" });
  expect(await repo.wiki!.automacao!.cobertura()).toMatchObject({ concluidos: 3, pendentes: 5 });
});

it("cancelamento depois de uma resposta paga preserva a conclusão e não inicia a próxima", async () => {
  const { repo, gerar } = preparar(3);
  const controle = new AbortController();
  gerar.mockImplementation(async () => {
    controle.abort();
    return { proposta: { propostas: [] }, uso: { entrada: 100, saida: 20 } };
  });
  const resultado = await processarLoteWiki(repo, gerar, { tetoDiario: 200_000, sinal: controle.signal });
  expect(resultado.lote).toMatchObject({ processados: 1, parada: "cancelado" });
  expect(gerar).toHaveBeenCalledTimes(1);
  expect(await repo.wiki!.automacao!.cobertura()).toMatchObject({ concluidos: 1, pendentes: 2 });
});

it("um lote já cancelado não reivindica trabalho nem chama o modelo", async () => {
  const { repo, gerar } = preparar(3);
  const reivindicar = vi.spyOn(repo.wiki!.automacao!, "reivindicar");
  const resultado = await processarLoteWiki(repo, gerar, { tetoDiario: 200_000, sinal: AbortSignal.abort() });
  expect(resultado.lote).toMatchObject({ rodadas: 0, processados: 0, parada: "cancelado" });
  expect(reivindicar).not.toHaveBeenCalled();
  expect(gerar).not.toHaveBeenCalled();
});

it("não insiste no provedor quando uma rodada é adiada por configuração", async () => {
  const { repo, gerar } = preparar(3);
  const registro = vi.spyOn(console, "error").mockImplementation(() => {});
  gerar.mockRejectedValue(Object.assign(new Error("credencial privada"), { status: 401 }));
  const resultado = await processarLoteWiki(repo, gerar, { tetoDiario: 200_000 });
  expect(resultado).toMatchObject({ tipo: "adiado", motivo: "configuracao", lote: { processados: 0, parada: "adiado" } });
  expect(gerar).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(registro.mock.calls)).not.toContain("privada");
});
