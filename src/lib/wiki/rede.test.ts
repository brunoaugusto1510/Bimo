// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { criarRepositorioEmMemoria } from "../repositorio-de-notas/memoria";
import { executarFerramenta } from "../ferramentas";
import { entradaDaDescoberta, processarWiki } from "./automacao";
import type { ContextoWiki, GeradorAutomaticoWiki } from "./automacao-tipos";
import { ESTABILIDADE_DA_WIKI_SEGUNDOS } from "./configuracao";
import { consultarConhecimentoWiki } from "./consulta";
import { verificarSinteses } from "./observabilidade";

const ESPERA = (ESTABILIDADE_DA_WIKI_SEGUNDOS + 1) * 1000;
const autor = { criadoPor: "usuario" as const };
type Repo = ReturnType<typeof criarRepositorioEmMemoria>;
const rodar = (repo: Repo, gerar: GeradorAutomaticoWiki) => processarWiki(repo, gerar, { tetoDiario: 5_000_000 });
const afirmacao = (texto: string, fonteId: string, citacao: string) => ({ texto, natureza: "explicita" as const, evidencias: [{ fonteId, citacao }] });
type Proposta = { titulo: string; alvoId: string | null; aliases: string[]; lacunas: string[]; afirmacoes: ReturnType<typeof afirmacao>[];
  ligacoes?: string[]; resumo?: string | null };
const proposta = (extras: Partial<Proposta>): Proposta => ({ titulo: "Sem título", alvoId: null, aliases: [], lacunas: [], afirmacoes: [], ...extras });
const com = (...propostas: Proposta[]): GeradorAutomaticoWiki => async () => ({ proposta: { propostas }, uso: { entrada: 1, saida: 1 } });

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-27T12:00:00Z")); });
afterEach(() => vi.useRealTimers());

const PAO = "A massa fermenta devagar na geladeira por doze horas";
const FORNO = "O forno precisa estar bem quente antes de assar o pão";
const LEITURA = "Ler devagar ajuda a lembrar do que eu li";

async function idPorTitulo(repo: Repo, titulo: string) {
  for (const p of await repo.wiki!.listar()) if ((await repo.obterNota(p.notaId))!.titulo === titulo) return p.notaId;
  throw new Error(`Neurônio ausente: ${titulo}`);
}

/** Uma nota que gera dois neurônios na mesma resposta. */
async function comNotaDePao() {
  const repo = criarRepositorioEmMemoria([{ titulo: "Pão de fermentação natural", conteudo: `${PAO}. ${FORNO}.` }]);
  vi.advanceTimersByTime(ESPERA);
  const origem = (await repo.listarResumos())[0].id;
  return { repo, origem };
}

describe("ligações entre neurônios nascidos na mesma resposta", () => {
  it("proposta:N liga as duas propostas, nos dois sentidos, nos dados e no texto", async () => {
    const { repo, origem } = await comNotaDePao();
    const r = await rodar(repo, com(
      proposta({ titulo: "Fermentação lenta", ligacoes: ["proposta:2"], afirmacoes: [afirmacao("A massa fermenta devagar", origem, PAO)] }),
      proposta({ titulo: "Forno quente", afirmacoes: [afirmacao("O forno vai bem quente", origem, FORNO)] }),
    ));
    expect(r).toMatchObject({ publicadas: 2, descartadas: 0 });
    const fermentacao = await idPorTitulo(repo, "Fermentação lenta");
    const forno = await idPorTitulo(repo, "Forno quente");
    expect((await repo.wiki!.obter(fermentacao))!.estrutura.ligacoes).toEqual([forno]);
    expect((await repo.wiki!.obter(forno))!.estrutura.ligacoes).toEqual([fermentacao]);
    expect((await repo.obterNota(fermentacao))!.conteudo).toContain("[[Neurônios/Forno quente]]");
    expect((await repo.obterNota(forno))!.conteudo).toContain("[[Neurônios/Fermentação lenta]]");
  });

  it("uma referência a si mesma, a uma posição inexistente ou a uma proposta descartada é ignorada", async () => {
    const { repo, origem } = await comNotaDePao();
    const r = await rodar(repo, com(
      proposta({ titulo: "Fermentação lenta", ligacoes: ["proposta:1", "proposta:9", "proposta:2"], afirmacoes: [afirmacao("A massa fermenta devagar", origem, PAO)] }),
      // Citação que não existe na nota: a proposta 2 é descartada e não pode virar ligação.
      proposta({ titulo: "Inventado", afirmacoes: [afirmacao("Algo", origem, "texto que não está na nota de jeito nenhum")] }),
    ));
    expect(r).toMatchObject({ publicadas: 1 });
    const fermentacao = await idPorTitulo(repo, "Fermentação lenta");
    expect((await repo.wiki!.obter(fermentacao))!.estrutura.ligacoes).toEqual([]);
    expect((await repo.obterNota(fermentacao))!.conteudo).not.toContain("## Neurônios relacionados");
  });

  it("proposta:N para uma síntese existente que já tem o link não a republica", async () => {
    const { repo, origem } = await comNotaDePao();
    await rodar(repo, com(
      proposta({ titulo: "Fermentação lenta", ligacoes: ["proposta:2"], afirmacoes: [afirmacao("A massa fermenta devagar", origem, PAO)] }),
      proposta({ titulo: "Forno quente", afirmacoes: [afirmacao("O forno vai bem quente", origem, FORNO)] }),
    ));
    const fermentacao = await idPorTitulo(repo, "Fermentação lenta");
    const forno = await idPorTitulo(repo, "Forno quente");
    const revisoes = [(await repo.obterNota(fermentacao))!.revisao, (await repo.obterNota(forno))!.revisao];
    await repo.criarNota({ titulo: "Mais pão", conteudo: "A massa fermenta devagar e o sabor fica mais ácido no dia seguinte." }, autor);
    vi.advanceTimersByTime(ESPERA);
    // A nota nova não diz nada além de repetir a ligação que as duas já têm.
    const r = await rodar(repo, com(proposta({ alvoId: fermentacao, titulo: "Fermentação lenta", ligacoes: ["proposta:2"] }),
      proposta({ alvoId: forno, titulo: "Forno quente", ligacoes: ["proposta:1"] })));
    expect(r).toMatchObject({ publicadas: 0 });
    expect([(await repo.obterNota(fermentacao))!.revisao, (await repo.obterNota(forno))!.revisao]).toEqual(revisoes);
  });

  it("a ligação entre irmãs só vale com vaga nas duas pontas", async () => {
    const { repo, origem } = await comNotaDePao();
    await rodar(repo, com(
      proposta({ titulo: "Fermentação lenta", ligacoes: ["proposta:2"], afirmacoes: [afirmacao("A massa fermenta devagar", origem, PAO)] }),
      proposta({ titulo: "Forno quente", afirmacoes: [afirmacao("O forno vai bem quente", origem, FORNO)] }),
    ));
    const pares = await Promise.all((await repo.wiki!.listar()).map(async (p) => [p.notaId, p.estrutura.ligacoes] as const));
    for (const [id, ligacoes] of pares) for (const outro of ligacoes) expect(pares.find(([x]) => x === outro)![1]).toContain(id);
  });

  it("aceita até seis propostas numa resposta", async () => {
    const frases = Array.from({ length: 6 }, (_, i) => `O assunto número ${i} tem uma explicação própria e completa`);
    const repo = criarRepositorioEmMemoria([{ titulo: "Muitos assuntos", conteudo: frases.join(". ") }]);
    vi.advanceTimersByTime(ESPERA);
    const origem = (await repo.listarResumos())[0].id;
    const r = await rodar(repo, com(...frases.map((f, i) => proposta({ titulo: `Assunto ${i}`, afirmacoes: [afirmacao(`Fala do assunto ${i}`, origem, f)] }))));
    expect(r).toMatchObject({ publicadas: 6, descartadas: 0 });
  });
});

describe("resumo de uma linha", () => {
  it("fica guardado, chega ao índice que o modelo vê e se mantém quando a atualização não o informa", async () => {
    const { repo, origem } = await comNotaDePao();
    await rodar(repo, com(proposta({ titulo: "Fermentação lenta", resumo: "Como o tempo na geladeira desenvolve a massa.",
      afirmacoes: [afirmacao("A massa fermenta devagar", origem, PAO)] })));
    const id = await idPorTitulo(repo, "Fermentação lenta");
    expect((await repo.wiki!.obter(id))!.estrutura.resumo).toBe("Como o tempo na geladeira desenvolve a massa.");
    expect((await repo.wiki!.automacao!.conceitos())[0].resumo).toBe("Como o tempo na geladeira desenvolve a massa.");

    await repo.criarNota({ titulo: "Mais pão", conteudo: "A massa fermenta devagar e o sabor fica mais ácido no dia seguinte." }, autor);
    vi.advanceTimersByTime(ESPERA);
    let visto: ContextoWiki | undefined;
    await rodar(repo, async (c) => {
      visto = c;
      return { proposta: { propostas: [proposta({ alvoId: id, titulo: "Fermentação lenta",
        afirmacoes: [afirmacao("O sabor fica mais ácido", c.origem.id, "o sabor fica mais ácido no dia seguinte")] })] }, uso: null };
    });
    expect(entradaDaDescoberta(visto!).indice.entradas.find((e) => e.id === id)!.resumo).toBe("Como o tempo na geladeira desenvolve a massa.");
    expect((await repo.wiki!.obter(id))!.estrutura.resumo).toBe("Como o tempo na geladeira desenvolve a massa.");
  });

  it("um neurônio sem resumo aparece no índice com a primeira afirmação", async () => {
    const { repo, origem } = await comNotaDePao();
    await rodar(repo, com(proposta({ titulo: "Fermentação lenta", afirmacoes: [afirmacao("A massa fermenta devagar", origem, PAO)] })));
    expect((await repo.wiki!.automacao!.conceitos())[0].resumo).toBe("A massa fermenta devagar");
  });
});

/** Dois neurônios ligados (pão → leitura) e uma nota nova que só fala de pão. */
async function comVizinhos() {
  // A fila lê na ordem de criação: a leitura vira neurônio antes, para o pão poder ligá-la.
  const repo = criarRepositorioEmMemoria([
    { titulo: "Leitura", conteudo: `${LEITURA}.` },
    { titulo: "Pão", conteudo: `${PAO}.` },
  ]);
  vi.advanceTimersByTime(ESPERA);
  const resumos = await repo.listarResumos();
  const leitura = resumos.find((n) => n.titulo === "Leitura")!.id;
  const pao = resumos.find((n) => n.titulo === "Pão")!.id;
  await rodar(repo, com(proposta({ titulo: "Leitura lenta", resumo: "Ler devagar para lembrar.", afirmacoes: [afirmacao("Ler devagar ajuda", leitura, LEITURA)] })));
  vi.advanceTimersByTime(1_000);
  const idLeitura = await idPorTitulo(repo, "Leitura lenta");
  await rodar(repo, com(proposta({ titulo: "Fermentação lenta", resumo: "O tempo desenvolve a massa.", ligacoes: [idLeitura],
    afirmacoes: [afirmacao("A massa fermenta devagar", pao, PAO)] })));
  return { repo, idLeitura, idPao: await idPorTitulo(repo, "Fermentação lenta") };
}

describe("recuperação e consulta seguindo ligações", () => {
  it("o vizinho de uma candidata entra no contexto da compilação, com quem o cita", async () => {
    const { repo, idLeitura, idPao } = await comVizinhos();
    await repo.criarNota({ titulo: "Geladeira", conteudo: "Deixei a massa na geladeira e ela fermenta devagar durante a noite." }, autor);
    vi.advanceTimersByTime(ESPERA);
    let visto: ContextoWiki | undefined;
    await rodar(repo, async (c) => { visto = c; return { proposta: { propostas: [] }, uso: null }; });
    const candidatas = entradaDaDescoberta(visto!).candidatas;
    expect(candidatas.map((c) => c.id)).toContain(idPao);
    expect(candidatas.map((c) => c.id)).toContain(idLeitura);
    expect(candidatas.find((c) => c.id === idLeitura)!.ligadoPor).toEqual([idPao]);
  });

  it("a consulta do chat traz os vizinhos do neurônio encontrado, com resumo", async () => {
    const { repo, idLeitura } = await comVizinhos();
    const r = await consultarConhecimentoWiki(repo, "fermentação", []);
    expect(r!.notas.map((n) => n.caminho)).toEqual(["Neurônios/Fermentação lenta.md"]);
    expect(r!.notas[0].resumo).toBe("O tempo desenvolve a massa.");
    expect(r!.relacionados).toEqual([{ caminho: "Neurônios/Leitura lenta.md", resumo: "Ler devagar para lembrar." }]);
    expect(idLeitura).toBeTruthy();
  });

  it("palavras curtas e comuns da pergunta não puxam neurônios por pedaço de palavra", async () => {
    const { repo } = await comVizinhos();
    // No casamento por substring, "com" e "fer" puxariam "comunicação" e "fermentação"; agora só palavra inteira conta.
    const r = await consultarConhecimentoWiki(repo, "com fer", []);
    expect(r!.notas).toEqual([]);
  });

  it("uma sigla em minúsculas também acha o neurônio, e o índice ignora consulta sem termo útil", async () => {
    const repo = criarRepositorioEmMemoria([{ titulo: "Redes", conteudo: "O handshake do TCP tem três etapas antes de enviar dados." }]);
    vi.advanceTimersByTime(ESPERA);
    const origem = (await repo.listarResumos())[0].id;
    await rodar(repo, com(proposta({ titulo: "Handshake TCP", afirmacoes: [afirmacao("O handshake tem três etapas", origem, "O handshake do TCP tem três etapas")] })));
    expect((await consultarConhecimentoWiki(repo, "tcp", []))!.notas.map((n) => n.caminho)).toEqual(["Neurônios/Handshake TCP.md"]);
    const saida = await executarFerramenta("indice_da_wiki", { consulta: "com de para" }, { repositorio: repo });
    expect(saida.resposta).toMatchObject({ total: 1 });
  });

  it("o índice e os relacionados também deixam de fora um neurônio sem nenhuma origem", async () => {
    const { repo, idLeitura } = await comVizinhos();
    const leitura = (await repo.wiki!.obter(idLeitura))!.fontes[0].id;
    const listar = repo.listarResumos.bind(repo); const obter = repo.obterNota.bind(repo);
    vi.spyOn(repo, "listarResumos").mockImplementation(async () => (await listar()).filter((n) => n.id !== leitura));
    vi.spyOn(repo, "obterNota").mockImplementation(async (id) => (id === leitura ? null : obter(id)));
    const saida = await executarFerramenta("indice_da_wiki", {}, { repositorio: repo });
    expect((saida.resposta.neuronios as { caminho: string }[]).map((n) => n.caminho)).toEqual(["Neurônios/Fermentação lenta.md"]);
    expect((await consultarConhecimentoWiki(repo, "fermentação", []))!.relacionados).toEqual([]);
  });

  it("uma sigla de três letras na pergunta ainda acha o neurônio", async () => {
    const repo = criarRepositorioEmMemoria([{ titulo: "Redes", conteudo: "O handshake do TCP tem três etapas antes de enviar dados." }]);
    vi.advanceTimersByTime(ESPERA);
    const origem = (await repo.listarResumos())[0].id;
    await rodar(repo, com(proposta({ titulo: "Handshake TCP", afirmacoes: [afirmacao("O handshake tem três etapas", origem, "O handshake do TCP tem três etapas")] })));
    const r = await consultarConhecimentoWiki(repo, "TCP", []);
    expect(r!.notas.map((n) => n.caminho)).toEqual(["Neurônios/Handshake TCP.md"]);
  });

  it("um neurônio sem nenhuma nota de origem fica fora das respostas", async () => {
    const { repo, idPao } = await comVizinhos();
    const pao = (await repo.wiki!.obter(idPao))!.fontes[0].id;
    const obter = repo.obterNota.bind(repo);
    vi.spyOn(repo, "obterNota").mockImplementation(async (id) => (id === pao ? null : obter(id)));
    const r = await consultarConhecimentoWiki(repo, "fermentação", []);
    expect(r!.notas).toEqual([]);
  });
});

describe("índice da wiki para o chat", () => {
  it("lista os neurônios com resumo, ligações e quem os cita", async () => {
    const { repo } = await comVizinhos();
    const saida = await executarFerramenta("indice_da_wiki", {}, { repositorio: repo });
    expect(saida.erro).toBeUndefined();
    expect(saida.resposta).toMatchObject({ total: 2 });
    const neuronios = saida.resposta.neuronios as { caminho: string; resumo: string; ligaA: string[]; citadoPor: string[] }[];
    expect(neuronios).toEqual(expect.arrayContaining([
      { caminho: "Neurônios/Fermentação lenta.md", resumo: "O tempo desenvolve a massa.", ligaA: ["Neurônios/Leitura lenta.md"], citadoPor: [] },
      { caminho: "Neurônios/Leitura lenta.md", resumo: "Ler devagar para lembrar.", ligaA: [], citadoPor: ["Neurônios/Fermentação lenta.md"] },
    ]));
  });

  it("filtra pela consulta", async () => {
    const { repo } = await comVizinhos();
    const saida = await executarFerramenta("indice_da_wiki", { consulta: "massa" }, { repositorio: repo });
    expect((saida.resposta.neuronios as { caminho: string }[]).map((n) => n.caminho)).toEqual(["Neurônios/Fermentação lenta.md"]);
  });
});

describe("lint de rede", () => {
  it("marca o neurônio isolado sem pedir sua atenção e, se continuar isolado no dia seguinte, relê a origem uma vez", async () => {
    const { repo, idLeitura, idPao } = await comVizinhos();
    await repo.criarNota({ titulo: "Corrida", conteudo: "Correr no domingo de manhã me deixa disposto para a semana inteira." }, autor);
    vi.advanceTimersByTime(ESPERA);
    await rodar(repo, async (c) => ({ proposta: { propostas: [proposta({ titulo: "Corrida de domingo",
      afirmacoes: [afirmacao("Correr deixa disposto", c.origem.id, "Correr no domingo de manhã me deixa disposto")] })] }, uso: null }));
    const corrida = await idPorTitulo(repo, "Corrida de domingo");
    const origem = (await repo.wiki!.obter(corrida))!.fontes[0].id;
    vi.advanceTimersByTime(86_400_000);
    const reprocessar = vi.spyOn(repo.wiki!.automacao!, "reprocessar");
    await verificarSinteses(repo);
    const conceitos = await repo.wiki!.automacao!.conceitos();
    expect(conceitos.find((c) => c.notaId === corrida)!.diagnostico!.alertas).toEqual(["isolado"]);
    expect(conceitos.find((c) => c.notaId === idPao)!.diagnostico!.alertas).toEqual([]);
    expect(conceitos.find((c) => c.notaId === idLeitura)!.diagnostico!.alertas).toEqual([]);
    const eventos = await repo.wiki!.automacao!.diario({ inicio: "2026-01-01T00:00:00Z", fim: "2027-01-01T00:00:00Z" });
    expect(eventos.filter((e) => e.sinteseId === corrida && e.tipo === "precisa_de_voce")).toEqual([]);
    // No primeiro dia isolado, só o alerta: a origem acabou de ser lida.
    expect(reprocessar).not.toHaveBeenCalled();
    // Continua isolado no dia seguinte, com a fila ociosa: relê a origem uma vez.
    vi.advanceTimersByTime(86_400_000);
    await verificarSinteses(repo);
    expect(reprocessar).toHaveBeenCalledTimes(1);
    expect(reprocessar).toHaveBeenCalledWith(origem, 1);
    // Mais um dia isolado: a tentativa já foi feita e não há outra releitura.
    vi.advanceTimersByTime(86_400_000);
    await verificarSinteses(repo);
    expect(reprocessar).toHaveBeenCalledTimes(1);
  });

  it("republicar o neurônio relido, ainda isolado, não abre outra releitura paga", async () => {
    const { repo } = await comVizinhos();
    await repo.criarNota({ titulo: "Corrida", conteudo: "Correr no domingo de manhã me deixa disposto para a semana inteira." }, autor);
    vi.advanceTimersByTime(ESPERA);
    const corridaDe = (c: ContextoWiki, extras: Partial<Proposta> = {}) => ({ proposta: { propostas: [proposta({ titulo: "Corrida de domingo",
      afirmacoes: [afirmacao("Correr deixa disposto", c.origem.id, "Correr no domingo de manhã me deixa disposto")], ...extras })] }, uso: null });
    await rodar(repo, async (c) => corridaDe(c));
    const corrida = await idPorTitulo(repo, "Corrida de domingo");
    const reprocessar = vi.spyOn(repo.wiki!.automacao!, "reprocessar");
    vi.advanceTimersByTime(86_400_000); await verificarSinteses(repo);
    vi.advanceTimersByTime(86_400_000); await verificarSinteses(repo);
    expect(reprocessar).toHaveBeenCalledTimes(1);
    // A releitura só muda o resumo: o neurônio é republicado e continua sem ligações.
    await processarWiki(repo, async (c) => corridaDe(c, { alvoId: corrida, resumo: "Por que correr cedo ajuda a semana." }), { tetoDiario: 5_000_000, verificar: false });
    expect((await repo.wiki!.obter(corrida))!.estrutura.resumo).toBe("Por que correr cedo ajuda a semana.");
    for (let dia = 0; dia < 4; dia++) { vi.advanceTimersByTime(86_400_000); await verificarSinteses(repo); }
    expect(reprocessar).toHaveBeenCalledTimes(1);
  });

  it("com leitura pendente na fila, não relê origem de neurônio isolado", async () => {
    const { repo } = await comVizinhos();
    await repo.criarNota({ titulo: "Corrida", conteudo: "Correr no domingo de manhã me deixa disposto para a semana inteira." }, autor);
    vi.advanceTimersByTime(ESPERA);
    await rodar(repo, async (c) => ({ proposta: { propostas: [proposta({ titulo: "Corrida de domingo",
      afirmacoes: [afirmacao("Correr deixa disposto", c.origem.id, "Correr no domingo de manhã me deixa disposto")] })] }, uso: null }));
    vi.advanceTimersByTime(86_400_000);
    await verificarSinteses(repo);
    await repo.criarNota({ titulo: "Nova", conteudo: "Uma anotação nova ainda não lida pela fila." }, autor);
    vi.advanceTimersByTime(86_400_000);
    const reprocessar = vi.spyOn(repo.wiki!.automacao!, "reprocessar");
    await verificarSinteses(repo);
    expect(reprocessar).not.toHaveBeenCalled();
  });
});
