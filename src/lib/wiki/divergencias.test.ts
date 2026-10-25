// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { criarRepositorioEmMemoria } from "../repositorio-de-notas/memoria";
import { processarWiki } from "./automacao";
import { obterCerebroWiki } from "./observabilidade";

const autor = { criadoPor: "usuario" as const };
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-23T12:00:00Z")); });
afterEach(() => vi.useRealTimers());
const proposta = (extras: object) => ({ titulo: "Prazo de entrega", alvoId: null, aliases: [], lacunas: [], afirmacoes: [], ...extras });
it("guarda os dois contextos e resolve referências a afirmações novas para ids estáveis", async () => {
  const repo = criarRepositorioEmMemoria([{ titulo: "Manual", conteudo: "O prazo de entrega é de cinco dias para os pedidos." }]);
  const rodar = async (extras: object) => {
    vi.advanceTimersByTime(91_000);
    return processarWiki(repo, async (c) => ({ proposta: { propostas: [proposta({ afirmacoes: [{ texto: c.origem.conteudo, natureza: "explicita", evidencias: [{ fonteId: c.origem.id, citacao: c.origem.conteudo }] }], ...extras })] }, uso: { entrada: 1, saida: 1 } }), { tetoDiario: 200_000 });
  };
  await rodar({}); const [antes] = await repo.wiki!.listar();
  await repo.criarNota({ titulo: "Contrato", conteudo: "O prazo de entrega é de dez dias para os pedidos especiais." }, autor);
  await rodar({ alvoId: antes.notaId, divergencias: [{ a: { afirmacaoId: antes.afirmacoes[0].id, contexto: "Manual geral" }, b: { afirmacaoId: "nova:1", contexto: "Contrato de pedidos especiais" } }] });
  const meta = (await repo.wiki!.obter(antes.notaId))!;
  expect(meta.afirmacoes).toHaveLength(2);
  expect(meta.estrutura.divergencias).toEqual([{ a: { afirmacaoId: antes.afirmacoes[0].id, contexto: "Manual geral" }, b: { afirmacaoId: meta.afirmacoes[1].id, contexto: "Contrato de pedidos especiais" } }]);
  expect((await obterCerebroWiki(repo, 200_000)).neuronios[0].estado).toBe("em_tensao");
  expect((await repo.obterNota(antes.notaId))!.conteudo).toContain("Onde suas notas divergem");
  await repo.criarNota({ titulo: "Mais", conteudo: "O prazo não depende do horário de pagamento." }, autor);
  await rodar({ alvoId: antes.notaId, divergencias: [{ a: { afirmacaoId: "id-inventado", contexto: "A" }, b: { afirmacaoId: "nova:1", contexto: "B" } }] });
  expect((await repo.wiki!.obter(antes.notaId))!.estrutura.divergencias).toEqual(meta.estrutura.divergencias);
});
