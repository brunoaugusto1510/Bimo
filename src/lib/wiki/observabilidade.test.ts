// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { criarRepositorioEmMemoria } from "../repositorio-de-notas/memoria";
import { entradaDaDescoberta, processarWiki } from "./automacao";
import { obterCerebroWiki, verificarSinteses } from "./observabilidade";

const autor = { criadoPor: "usuario" as const };
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-23T12:00:00Z")); });
afterEach(() => vi.useRealTimers());
async function preparar() {
  const repo = criarRepositorioEmMemoria([{ titulo: "Memória", pasta: "Pessoal", conteudo: "A memória liga conceitos com evidência verificável." }]);
  vi.advanceTimersByTime(91_000);
  await processarWiki(repo, async (c) => ({ proposta: { propostas: [{ titulo: "Conhecimento", alvoId: null, aliases: [], lacunas: [],
    afirmacoes: [{ texto: "Conceitos se ligam", natureza: "explicita", evidencias: [{ fonteId: c.origem.id, citacao: c.origem.conteudo }] }] }] }, uso: { entrada: 100, saida: 50 } }), { tetoDiario: 200_000 });
  return { repo, id: (await repo.wiki!.listar())[0].notaId };
}
it("nasce na pasta Neurônios e o diário, cobertura e energia refletem a publicação", async () => {
  const { repo, id } = await preparar();
  expect((await repo.obterNota(id))!.pasta).toBe("Neurônios");
  const cerebro = await obterCerebroWiki(repo, 200_000);
  expect(cerebro.resumo).toMatchObject({ neuronios: 1, sinapses: 1, notasLidas: 1, totalDeNotas: 1, emConsolidacao: 0 });
  expect(cerebro.energia).toEqual({ teto: 200_000, utilizada: 150, restante: 199_850, renovaEm: "2026-10-24T00:00:00.000Z" });
  expect(cerebro.neuronios[0].estado).toBe("vivo");
  expect(await repo.wiki!.automacao!.diario({ inicio: "2026-10-23T00:00:00Z", fim: "2026-10-24T00:00:00Z" })).toEqual([expect.objectContaining({ tipo: "nasceu", sinteseId: id, origemId: "1" })]);
});
it("lint sem modelo registra mudança uma vez e detecta origem removida", async () => {
  const { repo, id } = await preparar();
  const resumos = await repo.listarResumos();
  vi.spyOn(repo, "listarResumos").mockResolvedValue(resumos.filter((n) => n.id !== "1"));
  const obter = repo.obterNota.bind(repo);
  vi.spyOn(repo, "obterNota").mockImplementation((id) => id === "1" ? Promise.resolve(null) : obter(id));
  await verificarSinteses(repo); await verificarSinteses(repo);
  const cerebro = await obterCerebroWiki(repo, 200_000);
  expect(cerebro.neuronios[0]).toMatchObject({ id, estado: "sem_raizes", alertas: ["sem_raizes"] });
  const eventos = await repo.wiki!.automacao!.diario({ inicio: "2026-10-23T00:00:00Z", fim: "2026-10-24T00:00:00Z" });
  expect(eventos.filter((e) => e.tipo === "precisa_de_voce")).toHaveLength(1);
});
it("pausa usa revisão, impede o enriquecimento e pode ser desfeita", async () => {
  const { repo, id } = await preparar();
  const fila = repo.wiki!.automacao!;
  expect(await fila.pausar(id, 99, true)).toBe("conflito");
  expect(await fila.pausar(id, 1, true)).toBe("ok");
  expect((await obterCerebroWiki(repo, 200_000)).neuronios[0].estado).toBe("em_pausa");
  await repo.criarNota({ titulo: "Outra memória", conteudo: "A memória integra conceitos e fatos novos." }, autor);
  vi.advanceTimersByTime(91_000);
  const resultado = await processarWiki(repo, async (c) => {
    expect(entradaDaDescoberta(c).candidatas.find((n) => n.id === id)).toMatchObject({ protegida: true, pausada: true });
    return { proposta: { propostas: [{ titulo: "Conhecimento", alvoId: id, aliases: [], lacunas: [],
      afirmacoes: [{ texto: "Fatos novos", natureza: "explicita", evidencias: [{ fonteId: c.origem.id, citacao: c.origem.conteudo }] }] }] }, uso: { entrada: 1, saida: 1 } };
  }, { tetoDiario: 200_000 });
  expect(resultado).toMatchObject({ publicadas: 0 });
  expect((await repo.obterNota(id))!.revisao).toBe(1);
  expect(await fila.pausar(id, 1, false)).toBe("ok");
  expect((await obterCerebroWiki(repo, 200_000)).neuronios[0].estado).toBe("vivo");
});
it("diagnóstico aponta possíveis duplicatas sem fundir notas nem repetir o alerta no dia seguinte", async () => {
  const repo = criarRepositorioEmMemoria([{ titulo: "A", conteudo: "A memória liga conceitos com evidência." }, { titulo: "B", conteudo: "Uma rede integra ideias com evidências de outras áreas." }]);
  vi.advanceTimersByTime(91_000);
  for (const titulo of ["Conhecimento", "Rede de ideias"]) await processarWiki(repo, async (c) => ({ proposta: { propostas: [{ titulo, alvoId: null, aliases: ["cognição"], lacunas: [],
    afirmacoes: [{ texto: c.origem.conteudo, natureza: "explicita", evidencias: [{ fonteId: c.origem.id, citacao: c.origem.conteudo }] }] }] }, uso: { entrada: 1, saida: 1 } }), { tetoDiario: 200_000 });
  vi.advanceTimersByTime(86_400_001); await verificarSinteses(repo);
  expect((await obterCerebroWiki(repo, 200_000)).neuronios.every((n) => n.alertas.includes("duplicata"))).toBe(true);
  const contar = async () => (await repo.wiki!.automacao!.diario({ inicio: "2026-10-23T00:00:00Z", fim: "2026-11-01T00:00:00Z" })).filter((e) => e.tipo === "precisa_de_voce").length;
  expect(await contar()).toBe(2);
  vi.advanceTimersByTime(86_400_001); await verificarSinteses(repo);
  expect(await contar()).toBe(2); expect(await repo.wiki!.listar()).toHaveLength(2);
});
it("diagnóstico reconhece duplicata legada com sufixos de síntese repetidos", async () => {
  const repo = criarRepositorioEmMemoria([{ titulo: "A", conteudo: "A memória liga conceitos com evidência." }, { titulo: "B", conteudo: "Uma rede integra ideias com evidências de outras áreas." }]);
  vi.advanceTimersByTime(91_000);
  for (const titulo of ["Conhecimento", "Rede de ideias"]) await processarWiki(repo, async (c) => ({ proposta: { propostas: [{ titulo, alvoId: null, aliases: [], lacunas: [],
    afirmacoes: [{ texto: c.origem.conteudo, natureza: "explicita", evidencias: [{ fonteId: c.origem.id, citacao: c.origem.conteudo }] }] }] }, uso: { entrada: 1, saida: 1 } }), { tetoDiario: 200_000 });
  const paginas = await repo.wiki!.listar();
  expect(await repo.renomearNota(paginas[1].notaId, "Conhecimento (síntese) (síntese)", { revisaoBase: 1, autor })).toMatchObject({ tipo: "ok" });
  vi.advanceTimersByTime(86_400_001); await verificarSinteses(repo);
  expect((await obterCerebroWiki(repo, 200_000)).neuronios.every((n) => n.alertas.includes("duplicata"))).toBe(true);
  expect(await repo.wiki!.listar()).toHaveLength(2);
});

it("diagnóstico avisa sobre anotações relacionadas a um neurônio protegido, sem escrever nele", async () => {
  const { repo, id } = await preparar();
  await repo.atualizarNota(id, { conteudo: "Meu conhecimento pessoal." }, { revisaoBase: 1, autor });
  await repo.criarNota({ titulo: "Conhecimento novo", conteudo: "O conhecimento pode aproximar assuntos diferentes." }, autor);
  const antes = (await repo.obterNota(id))!;
  await verificarSinteses(repo);
  expect((await obterCerebroWiki(repo, 200_000)).neuronios[0]).toMatchObject({ estado: "seu", alertas: ["protegida_com_novidades"] });
  expect(await repo.obterNota(id)).toEqual(antes);
});

it("registro consolidado preserva leitura direta sem virar tema ativo ou alerta de falta de raízes", async () => {
  const { repo, id } = await preparar();
  const [pagina] = await repo.wiki!.listar();
  const redirecionamento = { ...pagina, fontes: [], afirmacoes: [], estrutura: { ligacoes: ["principal"], lacunas: [],
    manutencao: { tipo: "consolidacao_autorizada", data: "2026-10-30", consolidadaEm: "principal" } } };
  vi.spyOn(repo.wiki!, "listar").mockResolvedValue([redirecionamento]);
  vi.spyOn(repo.wiki!, "obter").mockResolvedValue(redirecionamento);
  const registrar = vi.spyOn(repo.wiki!.automacao!, "registrarDiagnostico");
  vi.advanceTimersByTime(86_400_001);
  expect(await verificarSinteses(repo)).toBe(0);
  expect(registrar).not.toHaveBeenCalled();
  expect((await obterCerebroWiki(repo, 200_000)).resumo.neuronios).toBe(0);
  expect((await repo.obterNota(id))!.conteudo).toBeTruthy();
  expect(await repo.wiki!.obter(id)).toEqual(redirecionamento);
});
it("diagnóstico avisa quando um neurônio relacionado foi removido", async () => {
  const { repo, id } = await preparar(); const [meta] = await repo.wiki!.listar();
  vi.spyOn(repo.wiki!, "listar").mockResolvedValue([{ ...meta, estrutura: { ...meta.estrutura, ligacoes: ["removido"] } }]);
  await verificarSinteses(repo);
  expect((await obterCerebroWiki(repo, 200_000)).neuronios[0]).toMatchObject({ id, alertas: ["ligacao_quebrada"] });
});
