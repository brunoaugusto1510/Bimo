// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { criarRepositorioEmMemoria } from "../repositorio-de-notas/memoria";
import { processarWiki } from "./automacao";
import { obterCerebroWiki } from "./observabilidade";
import { POLITICA_EDITORIAL } from "./editorial";

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
  expect(await rodar({ alvoId: antes.notaId, divergencias: [{ a: { afirmacaoId: "id-inventado", contexto: "A" }, b: { afirmacaoId: "nova:1", contexto: "B" } }] }))
    .toMatchObject({ tipo: "processado", publicadas: 0, descartadas: 1 });
  expect((await repo.wiki!.obter(antes.notaId))!.estrutura.divergencias).toEqual(meta.estrutura.divergencias);
});

const fraseA = "No manual geral, a entrega ocorre em cinco dias úteis.";
const fraseB = "No contrato especial, a entrega ocorre em dez dias úteis.";
const criterio = { avaliacao: "suficiente", justificativa: "Permite comparar os prazos nos contextos documentados." };
const editorial = { acao: "criar", utilidade: criterio, ganho: criterio, destino: criterio, candidatas: [] };

it.each(["mesmo-id", "id-inventado", "indice-inexistente", "texto-duplicado"])("divergência %s impede publicação e conclusão, sem perder o consumo", async (caso) => {
  const repo = criarRepositorioEmMemoria([{ titulo: "Manual e contrato", conteudo: `${fraseA}\n${fraseB}` }]);
  vi.advanceTimersByTime(91_000);
  const r = await processarWiki(repo, async (c) => ({ proposta: { politica: POLITICA_EDITORIAL, semPublicacao: null, propostas: [proposta({
    editorial, afirmacoes: [fraseA, caso === "texto-duplicado" ? fraseA : fraseB].map((texto) => ({ texto, natureza: "explicita", evidencias: [{ fonteId: c.origem.id, citacao: texto }] })),
    divergencias: [{ a: { afirmacaoId: "nova:1", contexto: "Manual geral" }, b: {
      afirmacaoId: caso === "mesmo-id" ? "nova:1" : caso === "id-inventado" ? "inventado" : caso === "indice-inexistente" ? "nova:3" : "nova:2", contexto: "Contrato especial",
    } }],
  })] }, uso: { entrada: 31, saida: 7 } }), { tetoDiario: 200_000 });
  expect(r).toMatchObject({ tipo: "adiado", motivo: "revisar" });
  expect(await repo.wiki!.listar()).toHaveLength(0);
  expect(await repo.wiki!.automacao!.cobertura()).toMatchObject({ concluidos: 0, impedidos: 1 });
  expect((await repo.wiki!.automacao!.energia(200_000)).utilizada).toBe(38);
  expect((await repo.obterNota("1"))!.revisao).toBe(1);
});

it("divergência inválida não descarta uma proposta irmã válida nem declara cobertura completa", async () => {
  const repo = criarRepositorioEmMemoria([{ titulo: "Manual e contrato", conteudo: `${fraseA}\n${fraseB}` }]);
  vi.advanceTimersByTime(91_000);
  const r = await processarWiki(repo, async (c) => {
    const base = proposta({ editorial, afirmacoes: [{ texto: fraseA, natureza: "explicita", evidencias: [{ fonteId: c.origem.id, citacao: fraseA }] }] });
    return { proposta: { politica: POLITICA_EDITORIAL, semPublicacao: null, propostas: [base, { ...base, titulo: "Prazos especiais", divergencias: [
      { a: { afirmacaoId: "nova:1", contexto: "Geral" }, b: { afirmacaoId: "nova:1", contexto: "Especial" } },
    ] }] }, uso: { entrada: 31, saida: 7 } };
  }, { tetoDiario: 200_000 });
  expect(r).toMatchObject({ publicadas: 1, descartadas: 1 });
  expect(await repo.wiki!.listar()).toHaveLength(1);
  expect(await repo.wiki!.automacao!.cobertura()).toMatchObject({ concluidos: 0, impedidos: 1 });
});

it("não publica silenciosamente um novo par quando as dez vagas já estão ocupadas", async () => {
  const frases = Array.from({ length: 11 }, (_, i) => `O contrato do grupo ${i} prevê entrega em ${i + 1} dias úteis.`);
  const repo = criarRepositorioEmMemoria([{ titulo: "Contratos", conteudo: frases.join("\n") }]);
  vi.advanceTimersByTime(91_000);
  await processarWiki(repo, async (c) => ({ proposta: { politica: POLITICA_EDITORIAL, semPublicacao: null, propostas: [proposta({ editorial,
    afirmacoes: frases.map((texto) => ({ texto, natureza: "explicita", evidencias: [{ fonteId: c.origem.id, citacao: texto }] })),
    divergencias: frases.slice(1).map((_, i) => ({ a: { afirmacaoId: "nova:1", contexto: "Grupo 0" }, b: { afirmacaoId: `nova:${i + 2}`, contexto: `Grupo ${i + 1}` } })),
  })] }, uso: null }), { tetoDiario: 200_000 });
  const [antes] = await repo.wiki!.listar();
  expect(antes.estrutura.divergencias).toHaveLength(10);
  const nova = "O contrato do grupo adicional prevê entrega em vinte dias úteis.";
  await repo.criarNota({ titulo: "Contratos adicionais", conteudo: nova }, autor); vi.advanceTimersByTime(91_000);
  expect(await processarWiki(repo, async (c) => ({ proposta: { politica: POLITICA_EDITORIAL, semPublicacao: null, propostas: [proposta({
    alvoId: antes.notaId, editorial: { ...editorial, acao: "enriquecer", candidatas: [antes.notaId] },
    afirmacoes: [{ texto: nova, natureza: "explicita", evidencias: [{ fonteId: c.origem.id, citacao: nova }] }],
    divergencias: [{ a: { afirmacaoId: antes.afirmacoes[0].id, contexto: "Grupo 0" }, b: { afirmacaoId: "nova:1", contexto: "Grupo adicional" } }],
  })] }, uso: { entrada: 31, saida: 7 } }), { tetoDiario: 200_000 })).toMatchObject({ tipo: "adiado", motivo: "revisar" });
  expect((await repo.wiki!.obter(antes.notaId))!.afirmacoes).toEqual(antes.afirmacoes);
  expect((await repo.wiki!.obter(antes.notaId))!.estrutura.divergencias).toEqual(antes.estrutura.divergencias);
});

it.each(["mesmo-texto", "texto-alterado", "par-reconfirmado"])("substituição %s preserva a divergência ou exige reconfirmação explícita", async (caso) => {
  const repo = criarRepositorioEmMemoria([{ titulo: "Manual e contrato", conteudo: `${fraseA}\n${fraseB}` }]);
  vi.advanceTimersByTime(91_000);
  await processarWiki(repo, async (c) => ({ proposta: { politica: POLITICA_EDITORIAL, semPublicacao: null, propostas: [proposta({ editorial,
    afirmacoes: [fraseA, fraseB].map((texto) => ({ texto, natureza: "explicita", evidencias: [{ fonteId: c.origem.id, citacao: texto }] })),
    divergencias: [{ a: { afirmacaoId: "nova:1", contexto: "Manual" }, b: { afirmacaoId: "nova:2", contexto: "Contrato" } }],
  })] }, uso: null }), { tetoDiario: 200_000 });
  const [antes] = await repo.wiki!.listar();
  const texto = caso === "mesmo-texto" ? fraseA : "No manual atualizado, a entrega ocorre em sete dias úteis.";
  await repo.criarNota({ titulo: "Prazo do manual atualizado", conteudo: texto }, autor); vi.advanceTimersByTime(91_000);
  const r = await processarWiki(repo, async (c) => ({ proposta: { politica: POLITICA_EDITORIAL, semPublicacao: null, propostas: [proposta({
    alvoId: antes.notaId, editorial: { ...editorial, acao: "enriquecer", candidatas: [antes.notaId] },
    substituicoes: [{ id: antes.afirmacoes[0].id, afirmacao: { texto, natureza: "explicita", evidencias: [{ fonteId: c.origem.id, citacao: texto }] } }],
    divergencias: caso === "par-reconfirmado" ? [{ a: { afirmacaoId: antes.afirmacoes[0].id, contexto: "Manual atualizado" }, b: { afirmacaoId: antes.afirmacoes[1].id, contexto: "Contrato" } }] : [],
  })] }, uso: { entrada: 31, saida: 7 } }), { tetoDiario: 200_000 });
  const depois = (await repo.wiki!.obter(antes.notaId))!;
  if (caso === "texto-alterado") {
    expect(r).toMatchObject({ tipo: "adiado", motivo: "revisar" });
    expect(depois.afirmacoes).toEqual(antes.afirmacoes);
    expect(depois.estrutura.divergencias).toEqual(antes.estrutura.divergencias);
  } else {
    expect(r).toMatchObject({ publicadas: 1 });
    const trocada = depois.afirmacoes.find((a) => a.texto === texto)!;
    expect(trocada.id).not.toBe(antes.afirmacoes[0].id);
    expect(depois.estrutura.divergencias).toHaveLength(1);
    expect(depois.estrutura.divergencias![0]).toMatchObject({ a: { afirmacaoId: trocada.id }, b: { afirmacaoId: antes.afirmacoes[1].id } });
  }
});
