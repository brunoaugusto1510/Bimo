// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { criarRepositorioEmMemoria } from "../repositorio-de-notas/memoria";
import { entradaDaDescoberta, processarWiki } from "./automacao";
import { POLITICA_EDITORIAL } from "./editorial";
import * as recuperacao from "./recuperacao";
import type { ContextoWiki, GeradorAutomaticoWiki } from "./automacao-tipos";
import { ErroDaGeracaoWiki } from "./tipos";

const autor = { criadoPor: "usuario" as const };
const frase = "O cache local permite consultar cópias sem conexão de rede.";
const descricao = "No fluxo de consulta, a cópia local é exibida durante a indisponibilidade da rede.";
const criterio = (justificativa: string) => ({ avaliacao: "suficiente", justificativa });
const operacao = (fonte: string, alvoId: string | null = null) => ({ titulo: "Cache offline", alvoId, aliases: [], lacunas: [],
  afirmacoes: [{ texto: alvoId ? "As cópias expiram após 24 horas." : frase, natureza: "explicita", evidencias: [{ fonteId: fonte, citacao: alvoId ? "As cópias expiram após 24 horas." : frase }] }],
  editorial: { acao: alvoId ? "enriquecer" : "criar", utilidade: criterio("Como consultar os dados sem conexão?"),
    ganho: criterio("Reúne mecanismo e prazo de validade das cópias."), destino: criterio("O assunto pertence à página de cache offline."), candidatas: alvoId ? [alvoId] : [] } });
const envelope = (propostas: unknown[], semPublicacao: unknown = null) => ({ politica: POLITICA_EDITORIAL, propostas, semPublicacao });
const pedir = (ids: string[]) => envelope([], { decisao: "adiar", motivo: "Falta ler o conteúdo do neurônio pertinente.", condicao: "Ler os destinos indicados antes de decidir.",
  tipoDePendencia: "leitura_de_neuronio", neuroniosALer: ids });
const rodar = (repo: ReturnType<typeof criarRepositorioEmMemoria>, gerar: GeradorAutomaticoWiki) => processarWiki(repo, gerar, { tetoDiario: 5_000_000 });
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-25T12:00:00Z")); });
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });
const esperar = () => vi.advanceTimersByTime(91_000);

async function preparar() {
  const repo = criarRepositorioEmMemoria([{ titulo: "Estudo cache", conteudo: frase }]); esperar();
  await rodar(repo, async (c) => ({ proposta: envelope([operacao(c.origem.id)]), uso: { entrada: 1, saida: 1 } }));
  const [pagina] = await repo.wiki!.listar();
  await repo.criarNota({ titulo: "Prazo cache", conteudo: "As cópias expiram após 24 horas." }, autor); esperar();
  vi.spyOn(recuperacao, "recuperarContexto").mockResolvedValue({ candidatas: [], dependentes: [],
    indice: { total: 1, entradas: [{ id: pagina.notaId, titulo: "Cache offline", aliases: [], protegida: false }] } });
  return { repo, pagina };
}

it("payload diferencia fonte pessoal de neurônio e informa exatamente o que foi lido", () => {
  const nota = { id: "1", titulo: "Código", pasta: null, revisao: 1, conteudo: frase };
  const c: ContextoWiki = { origem: nota, trecho: { inicio: 0, fim: frase.length, texto: frase },
    candidatas: [{ nota: { ...nota, id: "2", titulo: "Documentação complementar" } }], dependentes: [],
    indice: { total: 1, entradas: [{ id: "3", titulo: "Outra síntese", aliases: [], protegida: false }] } };
  const entrada = entradaDaDescoberta(c);
  expect(entrada.origem).toMatchObject({ tipo: "nota_pessoal" });
  expect(entrada.candidatas[0]).toMatchObject({ tipo: "nota_pessoal", podeSerFonte: true, podeReceberEdicao: false });
  expect(entrada.papeis).toEqual({ fontesPessoaisLidas: ["1", "2"], neuroniosLidos: [], neuroniosSomenteNoIndice: ["3"] });
});

it("código e documentação pessoais podem sustentar uma nova síntese sem editar origens", async () => {
  const repo = criarRepositorioEmMemoria([{ titulo: "Cache código", conteudo: frase }, { titulo: "Cache documentação", conteudo: descricao }]); esperar();
  expect(await rodar(repo, async () => ({ proposta: envelope([{ ...operacao("1"), afirmacoes: [
    { texto: frase, natureza: "explicita", evidencias: [{ fonteId: "1", citacao: frase }] },
    { texto: descricao, natureza: "explicita", evidencias: [{ fonteId: "2", citacao: descricao }] },
  ] }]), uso: null }))).toMatchObject({ publicadas: 1 });
  const [pagina] = await repo.wiki!.listar();
  expect(pagina.fontes.map((f) => f.id)).toEqual(expect.arrayContaining(["1", "2"]));
  expect((await repo.obterNota("1"))!.revisao).toBe(1);
  expect((await repo.obterNota("2"))!.revisao).toBe(1);
});

it("identifica duplicatas integrais pelo conteúdo, sem confundir assunto parecido nem leitura parcial", () => {
  const origem = { id: "1", titulo: "Fatorial", pasta: null, revisao: 1, conteudo: "Um rascunho integral de código." };
  const c: ContextoWiki = { origem, trecho: { inicio: 0, fim: 3, texto: "Um " }, dependentes: [], indice: { total: 0, entradas: [] },
    candidatas: [{ nota: { ...origem, id: "2", titulo: "MDC" } }, { nota: { ...origem, id: "3", conteudo: `${origem.conteudo} Outra hipótese.` } }] };
  const entrada = entradaDaDescoberta(c);
  expect(entrada.origem.leituraParcial).toBe(true);
  expect(entrada.candidatas.map((p) => p.conteudoIgualAOrigem)).toEqual([true, false]);
});

it("lê um destino só do índice e conclui com uma única continuação contabilizada", async () => {
  const { repo, pagina } = await preparar();
  const antes = await repo.wiki!.automacao!.energia(5_000_000);
  const gerar = vi.fn<GeradorAutomaticoWiki>().mockResolvedValueOnce({ proposta: pedir([pagina.notaId]), uso: { entrada: 20, saida: 10 } })
    .mockImplementationOnce(async (c) => {
      expect(c.candidatas.find((v) => v.nota.id === pagina.notaId)?.metadados).toBeTruthy();
      expect(entradaDaDescoberta(c).papeis.neuroniosLidos).toContain(pagina.notaId);
      return { proposta: envelope([operacao(c.origem.id, pagina.notaId)]), uso: { entrada: 30, saida: 15 } };
    });
  expect(await rodar(repo, gerar)).toMatchObject({ publicadas: 1 });
  expect(gerar).toHaveBeenCalledTimes(2);
  expect((await repo.wiki!.obter(pagina.notaId))!.afirmacoes).toHaveLength(2);
  expect((await repo.wiki!.automacao!.energia(5_000_000)).utilizada - antes.utilizada).toBe(75);
});

it("não aceita pedir como neurônio uma nota pessoal nem repetir uma leitura já fornecida", async () => {
  const { repo } = await preparar();
  const gerar = vi.fn<GeradorAutomaticoWiki>().mockResolvedValue({ proposta: pedir(["1"]), uso: { entrada: 20, saida: 10 } });
  expect(await rodar(repo, gerar)).toMatchObject({ tipo: "adiado", motivo: "revisar" });
  expect(gerar).toHaveBeenCalledTimes(1);
});

it.each(["Cache offline (síntese)", "Cache offline (síntese) (síntese)"])("recusa recriar o neurônio só do índice usando o título %s", async (titulo) => {
  const { repo, pagina } = await preparar();
  const antes = (await repo.obterNota(pagina.notaId))!;
  const resultado = await rodar(repo, async (c) => ({ proposta: envelope([{ ...operacao(c.origem.id), titulo,
    afirmacoes: [{ texto: c.origem.conteudo, natureza: "explicita", evidencias: [{ fonteId: c.origem.id, citacao: c.origem.conteudo }] }],
  }]), uso: { entrada: 20, saida: 10 } }));
  expect(resultado).toMatchObject({ tipo: "adiado", motivo: "revisar" });
  expect(await repo.wiki!.listar()).toHaveLength(1);
  expect(await repo.obterNota(pagina.notaId)).toEqual(antes);
});

it("reconhece o título atual após renomear, sem recriar pela chave antiga", async () => {
  const { repo, pagina } = await preparar();
  expect(await repo.renomearNota(pagina.notaId, "Consulta durante indisponibilidade", { revisaoBase: 1, autor })).toMatchObject({ tipo: "ok" });
  const antes = (await repo.obterNota(pagina.notaId))!;
  const resultado = await rodar(repo, async (c) => ({ proposta: envelope([{ ...operacao(c.origem.id), titulo: "Consulta durante indisponibilidade (síntese)",
    afirmacoes: [{ texto: c.origem.conteudo, natureza: "explicita", evidencias: [{ fonteId: c.origem.id, citacao: c.origem.conteudo }] }],
  }]), uso: { entrada: 20, saida: 10 } }));
  expect(resultado).toMatchObject({ tipo: "adiado", motivo: "revisar" });
  expect(await repo.wiki!.listar()).toHaveLength(1);
  expect(await repo.obterNota(pagina.notaId)).toEqual(antes);
});

it("nega a continuação sem saldo, conservando o custo da primeira chamada e sem declarar conclusão", async () => {
  const { repo, pagina } = await preparar();
  const fila = repo.wiki!.automacao!;
  const reservar = fila.reservar;
  vi.spyOn(fila, "reservar").mockImplementationOnce(reservar).mockResolvedValueOnce(null);
  const antes = await fila.energia(5_000_000);
  const gerar = vi.fn<GeradorAutomaticoWiki>().mockResolvedValue({ proposta: pedir([pagina.notaId]), uso: { entrada: 20, saida: 10 } });
  expect(await rodar(repo, gerar)).toMatchObject({ tipo: "orcamento" });
  expect(gerar).toHaveBeenCalledTimes(1);
  expect((await fila.energia(5_000_000)).utilizada - antes.utilizada).toBe(30);
  expect((await fila.cobertura()).concluidos).toBe(1);
});

it("não faz uma terceira chamada se o modelo pede mais leituras após a continuação", async () => {
  const { repo, pagina } = await preparar();
  const gerar = vi.fn<GeradorAutomaticoWiki>().mockResolvedValue({ proposta: pedir([pagina.notaId]), uso: { entrada: 20, saida: 10 } });
  expect(await rodar(repo, gerar)).toMatchObject({ tipo: "adiado", motivo: "revisar" });
  expect(gerar).toHaveBeenCalledTimes(2);
});

it("pausa entre o pedido e a leitura impede uma continuação sobre o alvo protegido", async () => {
  const { repo, pagina } = await preparar();
  const gerar = vi.fn<GeradorAutomaticoWiki>().mockImplementationOnce(async () => {
    await repo.wiki!.automacao!.pausar(pagina.notaId, 1, true);
    return { proposta: pedir([pagina.notaId]), uso: { entrada: 20, saida: 10 } };
  });
  expect(await rodar(repo, gerar)).toMatchObject({ tipo: "adiado", motivo: "revisar" });
  expect(gerar).toHaveBeenCalledTimes(1);
  expect((await repo.obterNota(pagina.notaId))!.revisao).toBe(1);
});

it("falha cobrada na continuação preserva o consumo de ambas as chamadas", async () => {
  const { repo, pagina } = await preparar();
  const antes = await repo.wiki!.automacao!.energia(5_000_000);
  const gerar = vi.fn<GeradorAutomaticoWiki>().mockResolvedValueOnce({ proposta: pedir([pagina.notaId]), uso: { entrada: 20, saida: 10 } })
    .mockRejectedValueOnce(new ErroDaGeracaoWiki("Falha controlada.", { entrada: 30, saida: 15 }));
  expect(await rodar(repo, gerar)).toMatchObject({ tipo: "adiado", motivo: "revisar" });
  expect((await repo.wiki!.automacao!.energia(5_000_000)).utilizada - antes.utilizada).toBe(75);
  expect((await repo.obterNota(pagina.notaId))!.revisao).toBe(1);
});

it("reduz candidatas para caber no saldo, sem truncar o trecho da origem", async () => {
  const repo = criarRepositorioEmMemoria([{ titulo: "Cache código", conteudo: frase },
    { titulo: "Cache explicação", conteudo: `${frase} ${descricao.repeat(50)}` }]); esperar();
  let recebida: ContextoWiki | undefined;
  expect(await processarWiki(repo, async (c) => {
    recebida = c; return { proposta: { propostas: [] }, uso: { entrada: 10, saida: 5 } };
  }, { tetoDiario: 15_000 })).toMatchObject({ tipo: "processado" });
  expect(recebida!.trecho.texto).toBe(frase);
  expect(Buffer.byteLength(JSON.stringify(entradaDaDescoberta(recebida!)), "utf8") + 8192 + 4096).toBeLessThanOrEqual(15_000);
});

it("reprocessamento explícito preserva a origem, exige revisão e não rouba posse ativa", async () => {
  const repo = criarRepositorioEmMemoria([{ titulo: "Cache", conteudo: frase }]); esperar();
  await rodar(repo, async () => ({ proposta: { propostas: [] }, uso: null }));
  const fila = repo.wiki!.automacao!;
  expect(await fila.reprocessar("1", 99)).toBe("conflito");
  expect(await fila.reprocessar("1", 1)).toBe("ok");
  const trabalho = await fila.reivindicar();
  expect(trabalho?.geracao).toBe(2);
  expect(await fila.reprocessar("1", 1)).toBe("ocupado");
  expect((await repo.obterNota("1"))!.conteudo).toBe(frase);
  expect((await repo.obterNota("1"))!.revisao).toBe(1);
});
