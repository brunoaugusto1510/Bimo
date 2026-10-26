// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { criarRepositorioEmMemoria } from "../repositorio-de-notas/memoria";
import { processarWiki } from "./automacao";
import { POLITICA_EDITORIAL, esquemaDoEnvelopeEditorial } from "./editorial";
import type { GeradorAutomaticoWiki } from "./automacao-tipos";

const autor = { criadoPor: "usuario" as const };
const frase = "O cache local permite consultar cópias durante indisponibilidade da rede.";
const avaliar = (justificativa: string) => ({ avaliacao: "suficiente", justificativa });
const editorial = (acao = "criar", candidatas: string[] = []) => ({ acao,
  utilidade: avaliar("Como consultar dados durante uma falha de rede?"),
  ganho: avaliar("Organiza a estratégia de contingência e sua finalidade."),
  destino: avaliar("Assunto próprio, sem destino equivalente disponível."), candidatas });
const proposta = (fonteId: string, extras: Record<string, unknown> = {}) => ({ titulo: "Cache offline", alvoId: null, aliases: [],
  afirmacoes: [{ texto: frase, natureza: "explicita", evidencias: [{ fonteId, citacao: frase }] }],
  lacunas: [], editorial: editorial(), ...extras });
const envelope = (propostas: unknown[], semPublicacao: unknown = null) => ({ politica: POLITICA_EDITORIAL, propostas, semPublicacao });
const rodar = (repo: ReturnType<typeof criarRepositorioEmMemoria>, gerar: GeradorAutomaticoWiki) => processarWiki(repo, gerar, { tetoDiario: 5_000_000 });
const esperar = () => vi.advanceTimersByTime(91_000);
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-25T12:00:00Z")); });
afterEach(() => vi.useRealTimers());

it("conservar a origem conclui a leitura sem criar página nem chamar outra vez", async () => {
  const repo = criarRepositorioEmMemoria([{ titulo: "Lista", conteudo: "FlutterFlow, AWS API Gateway." }]); esperar();
  const gerar = vi.fn(async () => ({ proposta: envelope([], { decisao: "conservar_origem", motivo: "Lista sem contexto; outra página só a repetiria.", condicao: null }), uso: null }));
  expect(await rodar(repo, gerar)).toMatchObject({ tipo: "processado", publicadas: 0 });
  expect(await repo.wiki!.listar()).toHaveLength(0);
  expect(await repo.wiki!.automacao!.diario({ inicio: "2026-10-25T00:00:00Z", fim: "2026-10-26T00:00:00Z" }))
    .toEqual(expect.arrayContaining([expect.objectContaining({ texto: "Conservei o conhecimento na anotação de origem: Lista sem contexto; outra página só a repetiria." })]));
  expect(await rodar(repo, gerar)).toMatchObject({ tipo: "ocioso" });
  expect(gerar).toHaveBeenCalledTimes(1);
});

it("adiamento editorial não declara cobertura e não repete sem nova revisão", async () => {
  const repo = criarRepositorioEmMemoria([{ titulo: "Decisão", conteudo: "Usar a mesma regra do projeto anterior." }]); esperar();
  const gerar = vi.fn(async () => ({ proposta: envelope([], { decisao: "adiar", motivo: "Projeto não identificado.", condicao: "Identificar o projeto e sua regra na origem.", tipoDePendencia: "contexto_da_origem" }), uso: null }));
  expect(await rodar(repo, gerar)).toMatchObject({ tipo: "adiado", motivo: "revisar" });
  expect((await repo.wiki!.automacao!.cobertura()).concluidos).toBe(0);
  expect(await repo.wiki!.automacao!.diario({ inicio: "2026-10-25T00:00:00Z", fim: "2026-10-26T00:00:00Z" }))
    .toEqual(expect.arrayContaining([expect.objectContaining({ texto: expect.stringContaining("Identificar o projeto e sua regra na origem.") })]));
  esperar(); await rodar(repo, gerar); expect(gerar).toHaveBeenCalledTimes(1);
  await repo.atualizarNota("1", { conteudo: "Projeto Cache: usar cópias locais." }, { revisaoBase: 1, autor }); esperar();
  await rodar(repo, gerar); expect(gerar).toHaveBeenCalledTimes(2);
});

it("uma fonte e uma afirmação útil permitem criar, com procedência editorial", async () => {
  const repo = criarRepositorioEmMemoria([{ titulo: "Estudo", conteudo: frase }]); esperar();
  expect(await rodar(repo, async (c) => ({ proposta: envelope([proposta(c.origem.id)]), uso: null }))).toMatchObject({ publicadas: 1 });
  const [pagina] = await repo.wiki!.listar();
  expect(pagina.estrutura.editorial).toMatchObject({ politica: POLITICA_EDITORIAL, acao: "criar", origem: { id: "1", revisao: 1, inicio: 0, fim: frase.length } });
  expect((await repo.obterNota("1"))!.conteudo).toBe(frase);
});

it.each(["utilidade", "ganho", "destino"])("recusa criação com %s incerto, sem classificar como leitura bem sucedida", async (criterio) => {
  const repo = criarRepositorioEmMemoria([{ titulo: "Estudo", conteudo: frase }]); esperar();
  expect(await rodar(repo, async (c) => ({ proposta: envelope([proposta(c.origem.id, {
    editorial: { ...editorial(), [criterio]: { avaliacao: "incerto", justificativa: "Falta contexto." } },
  })]), uso: null }))).toMatchObject({ tipo: "adiado", motivo: "revisar" });
  expect(await repo.wiki!.listar()).toHaveLength(0);
  expect((await repo.wiki!.automacao!.cobertura()).concluidos).toBe(0);
});

it("não aceita adiar sem condição nem misturar publicação com decisão vazia", () => {
  expect(esquemaDoEnvelopeEditorial.safeParse(envelope([], { decisao: "adiar", motivo: "Dúvida", condicao: null })).success).toBe(false);
  expect(esquemaDoEnvelopeEditorial.safeParse(envelope([{}], { decisao: "conservar_origem", motivo: "Já basta", condicao: null })).success).toBe(false);
});

it("reforça evidência mantendo ID e inferência; repetição é idempotente", async () => {
  const repo = criarRepositorioEmMemoria([{ titulo: "Estudo", conteudo: frase }]); esperar();
  await rodar(repo, async (c) => ({ proposta: envelope([proposta(c.origem.id, {
    afirmacoes: [{ texto: frase, natureza: "inferencia", evidencias: [{ fonteId: c.origem.id, citacao: frase }] }],
  })]), uso: null }));
  const [antes] = await repo.wiki!.listar();
  const id = antes.afirmacoes[0].id;
  await repo.criarNota({ titulo: "Cache confirmação", conteudo: frase }, autor); esperar();
  const gerar: GeradorAutomaticoWiki = async (c) => ({ proposta: envelope([proposta(c.origem.id, {
    alvoId: antes.notaId, editorial: editorial("enriquecer", [antes.notaId]), afirmacoes: [],
    reforcos: [{ id, evidencias: [{ fonteId: c.origem.id, citacao: frase }] }],
  })]), uso: null });
  expect(await rodar(repo, gerar)).toMatchObject({ publicadas: 1 });
  const depois = (await repo.wiki!.obter(antes.notaId))!;
  expect(depois.afirmacoes).toHaveLength(1);
  expect(depois.afirmacoes[0]).toMatchObject({ id, natureza: "inferencia" });
  expect(depois.afirmacoes[0].evidencias).toHaveLength(2);
  const revisao = (await repo.obterNota(antes.notaId))!.revisao;
  expect(await rodar(repo, gerar)).toMatchObject({ tipo: "ocioso" });
  expect((await repo.obterNota(antes.notaId))!.revisao).toBe(revisao);
});

it("reforço preserva as referências de uma divergência existente", async () => {
  const outra = "No contrato antigo, a consulta exige conexão permanente com a rede.";
  const repo = criarRepositorioEmMemoria([{ titulo: "Estudo", conteudo: `${frase}\n${outra}` }]); esperar();
  await rodar(repo, async (c) => ({ proposta: envelope([proposta(c.origem.id, {
    afirmacoes: [frase, outra].map((texto) => ({ texto, natureza: "explicita", evidencias: [{ fonteId: c.origem.id, citacao: texto }] })),
    divergencias: [{ a: { afirmacaoId: "nova:1", contexto: "Contrato novo" }, b: { afirmacaoId: "nova:2", contexto: "Contrato antigo" } }],
  })]), uso: null }));
  const [pagina] = await repo.wiki!.listar();
  await repo.criarNota({ titulo: "Cache nova evidência", conteudo: frase }, autor); esperar();
  await rodar(repo, async (c) => ({ proposta: envelope([proposta(c.origem.id, { alvoId: pagina.notaId,
    editorial: editorial("enriquecer", [pagina.notaId]), afirmacoes: [],
    reforcos: [{ id: pagina.afirmacoes[0].id, evidencias: [{ fonteId: c.origem.id, citacao: frase }] }],
  })]), uso: null }));
  const depois = (await repo.wiki!.obter(pagina.notaId))!;
  expect(depois.estrutura.divergencias).toHaveLength(1);
  expect(depois.estrutura.divergencias).toEqual(pagina.estrutura.divergencias);
  expect(depois.afirmacoes.map((a) => a.id)).toEqual(pagina.afirmacoes.map((a) => a.id));
});

it.each(["id-inventado", "citação-inválida"])("reforço %s não publica nem apaga a evidência anterior", async (tipo) => {
  const repo = criarRepositorioEmMemoria([{ titulo: "Estudo", conteudo: frase }]); esperar();
  await rodar(repo, async (c) => ({ proposta: envelope([proposta(c.origem.id)]), uso: null }));
  const [pagina] = await repo.wiki!.listar();
  await repo.criarNota({ titulo: "Cache confirmação", conteudo: frase }, autor); esperar();
  expect(await rodar(repo, async (c) => ({ proposta: envelope([proposta(c.origem.id, { alvoId: pagina.notaId,
    editorial: editorial("enriquecer", [pagina.notaId]), afirmacoes: [],
    reforcos: [{ id: tipo === "id-inventado" ? "inventado" : pagina.afirmacoes[0].id,
      evidencias: [{ fonteId: c.origem.id, citacao: tipo === "citação-inválida" ? "Não consta na origem." : frase }] }],
  })]), uso: null }))).toMatchObject({ tipo: "adiado" });
  expect((await repo.wiki!.obter(pagina.notaId))!.afirmacoes).toEqual(pagina.afirmacoes);
});

it("limpa perguntas explicitamente, enquanto lista vazia mantém as anteriores", async () => {
  const repo = criarRepositorioEmMemoria([{ titulo: "Estudo", conteudo: frase }]); esperar();
  await rodar(repo, async (c) => ({ proposta: envelope([proposta(c.origem.id, { lacunas: ["Qual é a validade da cópia?"] })]), uso: null }));
  const [pagina] = await repo.wiki!.listar();
  for (const limparLacunas of [false, true]) {
    await repo.criarNota({ titulo: `Cache revisão ${limparLacunas}`, conteudo: frase }, autor); esperar();
    await rodar(repo, async (c) => ({ proposta: envelope([proposta(c.origem.id, { alvoId: pagina.notaId, afirmacoes: [],
      editorial: editorial("relacionar", [pagina.notaId]), limparLacunas })]), uso: null }));
    expect((await repo.wiki!.obter(pagina.notaId))!.estrutura.lacunas).toHaveLength(limparLacunas ? 0 : 1);
  }
});

it("não aceita enriquecimento sem leitura do destino nem criação de identidade já conhecida", async () => {
  const repo = criarRepositorioEmMemoria([{ titulo: "Estudo", conteudo: frase }]); esperar();
  await rodar(repo, async (c) => ({ proposta: envelope([proposta(c.origem.id)]), uso: null }));
  await repo.criarNota({ titulo: "Cache duplicado", conteudo: frase }, autor); esperar();
  expect(await rodar(repo, async (c) => ({ proposta: envelope([proposta(c.origem.id)]), uso: null }))).toMatchObject({ tipo: "adiado" });
  expect(await repo.wiki!.listar()).toHaveLength(1);
});

it("publica a proposta válida do conjunto, mas mantém a leitura impedida se outra falhou", async () => {
  const repo = criarRepositorioEmMemoria([{ titulo: "Estudo", conteudo: frase }]); esperar();
  const r = await rodar(repo, async (c) => ({ proposta: envelope([proposta(c.origem.id), proposta(c.origem.id, {
    titulo: "Outra proposta", afirmacoes: [{ texto: "Sem suporte", natureza: "explicita", evidencias: [{ fonteId: c.origem.id, citacao: "Frase inexistente na origem." }] }],
  })]), uso: null }));
  expect(r).toMatchObject({ publicadas: 1, descartadas: 1 });
  expect(await repo.wiki!.listar()).toHaveLength(1);
  expect(await repo.wiki!.automacao!.cobertura()).toMatchObject({ concluidos: 0, impedidos: 1 });
  esperar(); expect(await rodar(repo, vi.fn())).toMatchObject({ tipo: "ocioso" });
});

it("citação inválida em uma afirmação não permite declarar a proposta integralmente processada", async () => {
  const repo = criarRepositorioEmMemoria([{ titulo: "Estudo", conteudo: frase }]); esperar();
  expect(await rodar(repo, async (c) => {
    const p = proposta(c.origem.id);
    p.afirmacoes.push({ texto: "Outro fato", natureza: "explicita", evidencias: [{ fonteId: c.origem.id, citacao: "Esta frase não existe na origem." }] });
    return { proposta: envelope([p]), uso: null };
  })).toMatchObject({ tipo: "adiado", motivo: "revisar" });
  expect(await repo.wiki!.automacao!.cobertura()).toMatchObject({ concluidos: 0, impedidos: 1 });
});
