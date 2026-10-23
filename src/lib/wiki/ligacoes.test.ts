// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { criarRepositorioEmMemoria } from "../repositorio-de-notas/memoria";
import { entradaDaDescoberta, processarWiki } from "./automacao";
import type { ContextoWiki, GeradorAutomaticoWiki } from "./automacao-tipos";
import { ESTABILIDADE_DA_WIKI_SEGUNDOS } from "./configuracao";

const ESPERA = (ESTABILIDADE_DA_WIKI_SEGUNDOS + 1) * 1000;
const autor = { criadoPor: "usuario" as const };
type Repo = ReturnType<typeof criarRepositorioEmMemoria>;
const rodar = (repo: Repo, gerar: GeradorAutomaticoWiki) => processarWiki(repo, gerar, { tetoDiario: 5_000_000 });
const afirmacao = (texto: string, fonteId: string, citacao: string, natureza: "explicita" | "inferencia" = "explicita") => ({ texto, natureza, evidencias: [{ fonteId, citacao }] });
type Proposta = { titulo: string; alvoId: string | null; aliases: string[]; lacunas: string[]; afirmacoes: ReturnType<typeof afirmacao>[]; ligacoes?: string[] };
const proposta = (extras: Partial<Proposta>): Proposta => ({ titulo: "Paciência como método", alvoId: null, aliases: [], lacunas: [], afirmacoes: [], ...extras });
const com = (...propostas: Proposta[]): GeradorAutomaticoWiki => async () => ({ proposta: { propostas }, uso: { entrada: 1, saida: 1 } });

const PAO = "A massa fermenta devagar na geladeira por doze horas";
const LEITURA = "Ler devagar ajuda a lembrar do que eu li";
const DIARIO = "paciência serve tanto para o pão quanto para os livros";
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-22T12:00:00Z")); });
afterEach(() => vi.useRealTimers());

/** Duas sínteses ("Fermentação lenta" e "Ler devagar") e uma nota nova, o diário, ainda sem processar. */
async function comDoisNeuronios() {
  const repo = criarRepositorioEmMemoria([
    { titulo: "Fermentação", conteudo: `${PAO}.` },
    { titulo: "Leitura", conteudo: `${LEITURA}.` },
  ]);
  vi.advanceTimersByTime(ESPERA);
  const porOrigem: Record<string, [string, string]> = { Fermentação: ["Fermentação lenta", PAO], Leitura: ["Ler devagar", LEITURA] };
  const criar: GeradorAutomaticoWiki = async (c) => {
    const [titulo, citacao] = porOrigem[c.origem.titulo];
    return { proposta: { propostas: [proposta({ titulo, afirmacoes: [afirmacao(titulo, c.origem.id, citacao)] })] }, uso: null };
  };
  await rodar(repo, criar); vi.advanceTimersByTime(1_000); await rodar(repo, criar);
  const paginas = await repo.wiki!.listar();
  const idDe = async (titulo: string) => { for (const p of paginas) if ((await repo.obterNota(p.notaId))!.titulo === titulo) return p.notaId; throw new Error(titulo); };
  const diario = await repo.criarNota({ titulo: "Diário", conteudo: `Hoje percebi que ${DIARIO}.` }, autor);
  vi.advanceTimersByTime(ESPERA);
  return { repo, fermentacao: await idDe("Fermentação lenta"), leitura: await idDe("Ler devagar"), diario: diario.tipo === "ok" ? diario.nota.id : "" };
}
const paciencia = (c: { diario: string }, ligacoes: string[], extras: Partial<Proposta> = {}) =>
  proposta({ afirmacoes: [afirmacao("Paciência liga a massa e a leitura", c.diario, DIARIO, "inferencia")], ligacoes, ...extras });
const idDaNova = async (repo: Repo, antes: string[]) => (await repo.wiki!.listar()).find((p) => !antes.includes(p.notaId))!.notaId;

describe("ligações entre neurônios", () => {
  it("uma síntese nova liga outras sínteses: a lista fica guardada e o texto traz links de verdade", async () => {
    const c = await comDoisNeuronios();
    const antes = (await c.repo.wiki!.listar()).map((p) => p.notaId);
    const revisoes = await Promise.all(antes.map(async (id) => (await c.repo.obterNota(id))!.revisao));
    await rodar(c.repo, com(paciencia(c, [c.fermentacao, c.leitura])));
    const id = await idDaNova(c.repo, antes);
    expect((await c.repo.wiki!.obter(id))!.estrutura.ligacoes).toEqual([c.fermentacao, c.leitura]);
    const conteudo = (await c.repo.obterNota(id))!.conteudo;
    expect(conteudo).toContain("## Neurônios relacionados");
    expect(conteudo).toContain("[[Fermentação lenta]]");
    expect(conteudo).toContain("[[Ler devagar]]");
    // Quem é ligado não é tocado: nada de ligação de volta escrita no outro neurônio.
    expect(await Promise.all(antes.map(async (n) => (await c.repo.obterNota(n))!.revisao))).toEqual(revisoes);
  });

  it("ligar não é evidência: as origens da síntese continuam sendo só as notas pessoais citadas", async () => {
    const c = await comDoisNeuronios();
    const antes = (await c.repo.wiki!.listar()).map((p) => p.notaId);
    await rodar(c.repo, com(paciencia(c, [c.fermentacao, c.leitura])));
    const id = await idDaNova(c.repo, antes);
    expect((await c.repo.wiki!.automacao!.conceitos()).find((x) => x.notaId === id)!.origens).toEqual({ [c.diario]: 1 });
    expect((await c.repo.wiki!.obter(id))!.fontes.map((f) => f.id)).toEqual([c.diario]);
  });

  it("ids que não são sínteses existentes são ignorados, sem derrubar a proposta", async () => {
    const c = await comDoisNeuronios();
    const antes = (await c.repo.wiki!.listar()).map((p) => p.notaId);
    // "9999" não existe; o diário é uma nota pessoal, não uma síntese; repetido conta uma vez só.
    const r = await rodar(c.repo, com(paciencia(c, ["9999", c.diario, c.leitura, c.leitura])));
    expect(r).toMatchObject({ publicadas: 1, descartadas: 0 });
    expect((await c.repo.wiki!.obter(await idDaNova(c.repo, antes)))!.estrutura.ligacoes).toEqual([c.leitura]);
  });

  it("só se liga o que o modelo viu: uma síntese que existe mas ficou fora do índice e das candidatas é ignorada", async () => {
    const c = await comDoisNeuronios();
    const antes = (await c.repo.wiki!.listar()).map((p) => p.notaId);
    await rodar(c.repo, async (ctx) => {
      // Simula um índice truncado: a síntese existe, mas este contexto nunca a mostrou ao modelo.
      ctx.indice.entradas = ctx.indice.entradas.filter((e) => e.id !== c.fermentacao);
      ctx.candidatas = ctx.candidatas.filter((v) => v.nota.id !== c.fermentacao);
      return { proposta: { propostas: [paciencia(c, [c.fermentacao, c.leitura])] }, uso: null };
    });
    expect((await c.repo.wiki!.obter(await idDaNova(c.repo, antes)))!.estrutura.ligacoes).toEqual([c.leitura]);
  });

  it("uma síntese não se liga a si mesma ao ser enriquecida", async () => {
    const c = await comDoisNeuronios();
    await rodar(c.repo, com(paciencia(c, [c.fermentacao, c.fermentacao], { alvoId: c.fermentacao, titulo: "Fermentação lenta" })));
    expect((await c.repo.wiki!.obter(c.fermentacao))!.estrutura.ligacoes).toEqual([]);
  });

  it("enriquecer mantém as ligações que já existem e acrescenta as novas", async () => {
    const c = await comDoisNeuronios();
    const antes = (await c.repo.wiki!.listar()).map((p) => p.notaId);
    await rodar(c.repo, com(paciencia(c, [c.fermentacao])));
    const id = await idDaNova(c.repo, antes);
    const outra = await c.repo.criarNota({ titulo: "Mais um diário", conteudo: "A paciência também vale para a corrida de domingo, sempre devagar." }, autor);
    vi.advanceTimersByTime(ESPERA);
    await rodar(c.repo, com(proposta({ alvoId: id, ligacoes: [c.leitura],
      afirmacoes: [afirmacao("Vale para a corrida", outra.tipo === "ok" ? outra.nota.id : "", "paciência também vale para a corrida de domingo")] })));
    expect((await c.repo.wiki!.obter(id))!.estrutura.ligacoes).toEqual([c.fermentacao, c.leitura]);
    const conteudo = (await c.repo.obterNota(id))!.conteudo;
    expect(conteudo).toContain("[[Fermentação lenta]]");
    expect(conteudo).toContain("[[Ler devagar]]");
  });

  it("uma síntese editada à mão por você continua podendo ser ligada, sem ser alterada", async () => {
    const c = await comDoisNeuronios();
    const nota = (await c.repo.obterNota(c.leitura))!;
    await c.repo.atualizarNota(c.leitura, { conteudo: "Minha versão." }, { revisaoBase: nota.revisao, autor });
    const antes = (await c.repo.wiki!.listar()).map((p) => p.notaId);
    await rodar(c.repo, com(paciencia(c, [c.leitura])));
    expect((await c.repo.wiki!.obter(await idDaNova(c.repo, antes)))!.estrutura.ligacoes).toEqual([c.leitura]);
    expect((await c.repo.obterNota(c.leitura))!.conteudo).toBe("Minha versão.");
  });

  it("renomear uma síntese ligada reescreve o link e a próxima atualização usa o nome novo", async () => {
    const c = await comDoisNeuronios();
    const antes = (await c.repo.wiki!.listar()).map((p) => p.notaId);
    await rodar(c.repo, com(paciencia(c, [c.fermentacao])));
    const id = await idDaNova(c.repo, antes);
    const ligada = (await c.repo.obterNota(c.fermentacao))!;
    await c.repo.renomearNota(c.fermentacao, "Fermentação lenta e fria", { revisaoBase: ligada.revisao, autor });
    expect((await c.repo.obterNota(id))!.conteudo).toContain("[[Fermentação lenta e fria]]");
    const outra = await c.repo.criarNota({ titulo: "Corrida", conteudo: "A paciência também vale para a corrida de domingo, sempre devagar." }, autor);
    vi.advanceTimersByTime(ESPERA);
    await rodar(c.repo, com(proposta({ alvoId: id,
      afirmacoes: [afirmacao("Vale para a corrida", outra.tipo === "ok" ? outra.nota.id : "", "paciência também vale para a corrida de domingo")] })));
    const conteudo = (await c.repo.obterNota(id))!.conteudo;
    expect(conteudo).toContain("[[Fermentação lenta e fria]]");
    expect(conteudo).not.toContain("[[Fermentação lenta]]");
  });

  it("no máximo oito ligações por síntese", async () => {
    const repo = criarRepositorioEmMemoria(Array.from({ length: 10 }, (_, i) => ({ titulo: `Tema ${i}`, conteudo: `O tema número ${i} merece uma anotação própria com bastante texto.` })));
    vi.advanceTimersByTime(ESPERA);
    const criar: GeradorAutomaticoWiki = async (c) => {
      const numero = c.origem.titulo.replace("Tema ", "");
      return { proposta: { propostas: [proposta({ titulo: `Conceito ${numero}`,
        afirmacoes: [afirmacao(`Fala do tema ${numero}`, c.origem.id, `O tema número ${numero} merece uma anotação própria`)] })] }, uso: null };
    };
    for (let i = 0; i < 10; i++) { await rodar(repo, criar); vi.advanceTimersByTime(1_000); }
    const neuronios = (await repo.wiki!.listar()).map((p) => p.notaId);
    expect(neuronios).toHaveLength(10);
    const nova = await repo.criarNota({ titulo: "Panorama", conteudo: "Todos esses temas se conectam por uma ideia central de organização." }, autor);
    vi.advanceTimersByTime(ESPERA);
    await rodar(repo, com(proposta({ titulo: "Organização geral", ligacoes: neuronios,
      afirmacoes: [afirmacao("Há uma ideia central", nova.tipo === "ok" ? nova.nota.id : "", "esses temas se conectam por uma ideia central")] })));
    const id = (await repo.wiki!.listar()).find((p) => !neuronios.includes(p.notaId))!.notaId;
    expect((await repo.wiki!.obter(id))!.estrutura.ligacoes).toEqual(neuronios.slice(0, 8));
  });

  it("uma lista enorme de ligações não derruba a proposta: o servidor guarda só as oito primeiras que valem", async () => {
    const c = await comDoisNeuronios();
    const antes = (await c.repo.wiki!.listar()).map((p) => p.notaId);
    const lixo = Array.from({ length: 31 }, (_, i) => `nao-existe-${i}`);
    // A leitura está entre as 32 primeiras pedidas; a fermentação, na 33ª, passa do que o servidor lê.
    const r = await rodar(c.repo, com(paciencia(c, [c.leitura, ...lixo, c.fermentacao])));
    expect(r).toMatchObject({ publicadas: 1, descartadas: 0 });
    expect((await c.repo.wiki!.obter(await idDaNova(c.repo, antes)))!.estrutura.ligacoes).toEqual([c.leitura]);
  });

  it("numa síntese que já existe, só ligar a outra já é uma mudança; repetir a mesma ligação não é", async () => {
    const c = await comDoisNeuronios();
    const ligar = proposta({ alvoId: c.fermentacao, titulo: "Fermentação lenta", ligacoes: [c.leitura] });
    expect(await rodar(c.repo, com(ligar))).toMatchObject({ publicadas: 1, descartadas: 0 });
    expect((await c.repo.wiki!.obter(c.fermentacao))!.estrutura.ligacoes).toEqual([c.leitura]);
    expect((await c.repo.obterNota(c.fermentacao))!.conteudo).toContain("[[Ler devagar]]");
    // As afirmações continuam as mesmas: nada foi perdido ao só ligar.
    expect((await c.repo.wiki!.obter(c.fermentacao))!.afirmacoes).toHaveLength(1);
    // Nova nota para a fila ter o que avaliar; o modelo repete a mesma ligação e a síntese não é republicada.
    await c.repo.criarNota({ titulo: "Outra", conteudo: "Texto sem relação nenhuma com isso." }, autor);
    vi.advanceTimersByTime(ESPERA);
    const revisao = (await c.repo.obterNota(c.fermentacao))!.revisao;
    await rodar(c.repo, com(ligar));
    expect((await c.repo.obterNota(c.fermentacao))!.revisao).toBe(revisao);
  });

  it("se a síntese ligada for renomeada durante a geração, nada é publicado com o link velho", async () => {
    const c = await comDoisNeuronios();
    const antes = (await c.repo.wiki!.listar()).map((p) => p.notaId);
    // A janela real: o texto já foi montado com o nome antigo e a renomeação chega antes da publicação.
    const fila = c.repo.wiki!.automacao!;
    const concluir = fila.concluir.bind(fila);
    const espiao = vi.spyOn(fila, "concluir").mockImplementationOnce(async (...args) => {
      const ligada = (await c.repo.obterNota(c.fermentacao))!;
      await c.repo.renomearNota(c.fermentacao, "Fermentação lenta e fria", { revisaoBase: ligada.revisao, autor });
      return concluir(...args);
    });
    await rodar(c.repo, com(paciencia(c, [c.fermentacao])));
    espiao.mockRestore();
    // A publicação foi recusada (conflito temporário) e nada saiu com o caminho antigo.
    expect((await c.repo.wiki!.listar()).map((p) => p.notaId)).toEqual(antes);
    // Na tentativa seguinte, já com o nome novo, a ligação sai certa.
    vi.advanceTimersByTime(ESPERA);
    await rodar(c.repo, com(paciencia(c, [c.fermentacao])));
    const conteudo = (await c.repo.obterNota(await idDaNova(c.repo, antes)))!.conteudo;
    expect(conteudo).toContain("[[Fermentação lenta e fria]]");
  });

  it("o modelo vê as ligações atuais e as perguntas em aberto de cada candidata", async () => {
    const c = await comDoisNeuronios();
    const antes = (await c.repo.wiki!.listar()).map((p) => p.notaId);
    await rodar(c.repo, com(paciencia(c, [c.fermentacao], { lacunas: ["Quanto tempo é paciência demais?"] })));
    const id = await idDaNova(c.repo, antes);
    const outra = await c.repo.criarNota({ titulo: "Corrida", conteudo: "A paciência também vale para a corrida de domingo, sempre devagar." }, autor);
    vi.advanceTimersByTime(ESPERA);
    let visto: ContextoWiki | undefined;
    await rodar(c.repo, async (ctx) => { visto = ctx; return { proposta: { propostas: [] }, uso: null }; });
    const candidata = entradaDaDescoberta(visto!).candidatas.find((v) => v.id === id)!;
    expect(outra.tipo).toBe("ok");
    expect(candidata.ligacoes).toEqual([c.fermentacao]);
    expect(candidata.lacunas).toEqual(["Quanto tempo é paciência demais?"]);
  });
});

describe("perguntas em aberto", () => {
  async function comPergunta() {
    const c = await comDoisNeuronios();
    const antes = (await c.repo.wiki!.listar()).map((p) => p.notaId);
    await rodar(c.repo, com(paciencia(c, [], { lacunas: ["Quanto tempo é paciência demais?"] })));
    const id = await idDaNova(c.repo, antes);
    const outra = await c.repo.criarNota({ titulo: "Corrida", conteudo: "A paciência também vale para a corrida de domingo, sempre devagar." }, autor);
    vi.advanceTimersByTime(ESPERA);
    return { ...c, id, outra: outra.tipo === "ok" ? outra.nota.id : "" };
  }
  const enriquecer = (x: { id: string; outra: string }, lacunas: string[]) => proposta({ alvoId: x.id, lacunas,
    afirmacoes: [afirmacao("Vale para a corrida", x.outra, "paciência também vale para a corrida de domingo")] });

  it("ficam guardadas como dado e aparecem no texto", async () => {
    const x = await comPergunta();
    expect((await x.repo.wiki!.obter(x.id))!.estrutura.lacunas).toEqual(["Quanto tempo é paciência demais?"]);
    expect((await x.repo.obterNota(x.id))!.conteudo).toContain("Quanto tempo é paciência demais?");
  });

  it("enriquecer sem informar perguntas mantém as que já existem", async () => {
    const x = await comPergunta();
    await rodar(x.repo, com(enriquecer(x, [])));
    expect((await x.repo.wiki!.obter(x.id))!.estrutura.lacunas).toEqual(["Quanto tempo é paciência demais?"]);
    expect((await x.repo.obterNota(x.id))!.conteudo).toContain("Quanto tempo é paciência demais?");
  });

  it("perguntas vazias ou só de espaços não limpam as que existem nem viram um item vazio", async () => {
    const x = await comPergunta();
    await rodar(x.repo, com(enriquecer(x, ["", "   "])));
    expect((await x.repo.wiki!.obter(x.id))!.estrutura.lacunas).toEqual(["Quanto tempo é paciência demais?"]);
    expect((await x.repo.obterNota(x.id))!.conteudo).not.toMatch(/^- *$/m);
  });

  it("só mudar as perguntas, sem afirmação nova, já publica", async () => {
    const x = await comPergunta();
    const r = await rodar(x.repo, com(proposta({ alvoId: x.id, lacunas: ["E na corrida longa?"] })));
    expect(r).toMatchObject({ publicadas: 1, descartadas: 0 });
    expect((await x.repo.wiki!.obter(x.id))!.estrutura.lacunas).toEqual(["E na corrida longa?"]);
    expect((await x.repo.wiki!.obter(x.id))!.afirmacoes).toHaveLength(1);
  });

  it("enriquecer informando a lista nova a substitui", async () => {
    const x = await comPergunta();
    await rodar(x.repo, com(enriquecer(x, ["E na corrida longa?"])));
    expect((await x.repo.wiki!.obter(x.id))!.estrutura.lacunas).toEqual(["E na corrida longa?"]);
    expect((await x.repo.obterNota(x.id))!.conteudo).not.toContain("paciência demais");
  });
});
