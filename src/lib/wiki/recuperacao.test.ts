// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ResumoDeNota } from "../repositorio-de-notas/tipos";
import { criarRepositorioEmMemoria } from "../repositorio-de-notas/memoria";
import { entradaDaDescoberta, processarWiki } from "./automacao";
import type { ConceitoWiki, ContextoWiki, GeradorAutomaticoWiki } from "./automacao-tipos";
import { ESTABILIDADE_DA_WIKI_SEGUNDOS } from "./configuracao";
import { casa, construirIndice, ordenarTermos, palavrasEmComum, pontuarTermos, TERMOS_MAXIMOS } from "./recuperacao";

const ESPERA = (ESTABILIDADE_DA_WIKI_SEGUNDOS + 1) * 1000;
const rodar = (repo: ReturnType<typeof criarRepositorioEmMemoria>, gerar: GeradorAutomaticoWiki) => processarWiki(repo, gerar, { tetoDiario: 5_000_000 });
const proposta = (titulo: string, fonteId: string, citacao: string, extras: { alvoId?: string | null; aliases?: string[] } = {}) => ({
  titulo, alvoId: extras.alvoId ?? null, aliases: extras.aliases ?? [], lacunas: [],
  afirmacoes: [{ texto: `Sobre ${titulo}.`, natureza: "explicita" as const, evidencias: [{ fonteId, citacao }] }] });
const vazio = { proposta: { propostas: [] }, uso: { entrada: 1, saida: 1 } };
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-22T12:00:00Z")); });
afterEach(() => vi.useRealTimers());

describe("termos característicos da nota", () => {
  it("ordena pelo que a nota repete, valoriza o título e ignora palavras comuns", () => {
    const texto = "Para o TCP, como também muito mais. O quórum decide o líder; o quórum precisa de maioria. Quórum de escrita e quórum de leitura.";
    const termos = ordenarTermos("Replicação", texto).map((t) => t.termo);
    expect(termos[0]).toBe("quorum");
    expect(termos).toContain("replicacao");
    for (const comum of ["para", "como", "tambem", "muito", "mais"]) expect(termos).not.toContain(comum);
  });

  it("guarda siglas de três letras e descarta números soltos e palavras curtas", () => {
    const termos = ordenarTermos("Redes", "TCP e UDP usam a porta 8080 em 2024. O IP é de rede.").map((t) => t.termo);
    expect(termos).toEqual(expect.arrayContaining(["tcp", "udp"]));
    expect(termos).not.toContain("8080");
    expect(termos).not.toContain("2024");
    expect(termos).not.toContain("ip");
  });

  it("limita a lista preliminar", () => {
    const texto = Array.from({ length: 60 }, (_, i) => `palavra${String.fromCharCode(97 + (i % 26))}${i}x`).join(" ");
    expect(ordenarTermos("T", texto).length).toBeLessThanOrEqual(TERMOS_MAXIMOS);
  });

  it("acentos decompostos viram o mesmo termo que os compostos", () => {
    const decomposto = "O quórum decide. Quórum de escrita. Quórum de leitura.";
    expect(ordenarTermos("Replicação", decomposto).map((t) => t.termo)).toContain("quorum");
  });

  it("termo saturado na consulta vale como comum, não como raro, mesmo num acervo grande", () => {
    const pontuados = pontuarTermos([{ termo: "comum", peso: 2 }, { termo: "raro", peso: 2 }], new Map([["comum", 20], ["raro", 3]]), 1000);
    const porTermo = Object.fromEntries(pontuados.map((t) => [t.termo, t.idf]));
    expect(porTermo.comum).toBeLessThan(0.7);
    expect(porTermo.raro).toBeGreaterThan(5);
  });

  it("a própria nota fica fora da conta: num acervo pequeno o termo comum ainda recupera, mas pesa pouco", () => {
    const [universal] = pontuarTermos([{ termo: "universal", peso: 3 }], new Map([["universal", 4]]), 5);
    const [metade] = pontuarTermos([{ termo: "metade", peso: 3 }], new Map([["metade", 2]]), 5);
    expect(universal.idf).toBeGreaterThan(0);
    expect(universal.idf).toBeLessThan(0.2);
    expect(metade.idf).toBeGreaterThan(universal.idf * 4);
    // Duas notas só: o termo que a outra contém ainda conta.
    expect(pontuarTermos([{ termo: "tcp", peso: 2 }], new Map([["tcp", 1]]), 2)).toHaveLength(1);
  });

  it("só o plural simples casa: cache com caches sim, cache com cachecol não", () => {
    expect(casa("caches", "cache")).toBe(true);
    expect(casa("cache", "cache")).toBe(true);
    expect(casa("cachecol", "cache")).toBe(false);
    expect(casa("testemunho", "teste")).toBe(false);
    expect(palavrasEmComum("Consistência de caches", "Consistência de cache e réplicas")).toBe(true);
    expect(palavrasEmComum("Aeroportos", "Consistência de caches")).toBe(false);
  });

  it("rebaixa o termo que aparece em quase todo o acervo e descarta o que só existe na própria nota", () => {
    const preliminares = [{ termo: "sistema", peso: 2 }, { termo: "quorum", peso: 2 }, { termo: "unico", peso: 5 }];
    const pontuados = pontuarTermos(preliminares, new Map([["sistema", 18], ["quorum", 1], ["unico", 0]]), 40);
    expect(pontuados.map((t) => t.termo)).toEqual(["quorum", "sistema"]);
    expect(pontuados[0].pontuacao).toBeGreaterThan(pontuados[1].pontuacao * 2);
  });
});

describe("índice compacto de sínteses", () => {
  const conceito = (i: number, aliases: string[] = []): ConceitoWiki => ({ notaId: String(i), chave: `sintese ${i}`, aliases, protegida: i % 7 === 0, origens: {}, revisaoGerenciada: 1 });
  const resumos = (n: number) => new Map(Array.from({ length: n }, (_, i) => [String(i + 1), { id: String(i + 1), titulo: `Síntese ${i + 1}`, pasta: null } as ResumoDeNota]));

  it("limita entradas, aliases e tamanho, informa o total e traz primeiro o que casa com a nota", () => {
    const conceitos = Array.from({ length: 300 }, (_, i) => conceito(i + 1, Array.from({ length: 10 }, (_, j) => `apelido ${i + 1} ${j}`)));
    conceitos[250] = { ...conceitos[250], aliases: ["quorum de escrita", ...conceitos[250].aliases] };
    const indice = construirIndice(conceitos, resumos(300), pontuarTermos([{ termo: "quorum", peso: 2 }], new Map([["quorum", 1]]), 300));
    expect(indice.total).toBe(300);
    expect(indice.entradas.length).toBeLessThanOrEqual(120);
    expect(JSON.stringify(indice.entradas).length).toBeLessThanOrEqual(12_000);
    expect(indice.entradas[0].id).toBe("251");
    expect(indice.entradas.every((e) => e.aliases.length <= 6)).toBe(true);
  });

  it("sem aliases longos, o teto é de 120 entradas; sem termos, as sínteses mais recentes vêm primeiro", () => {
    const curtas = Array.from({ length: 300 }, (_, i) => ({ ...conceito(i + 1), protegida: false }));
    const indice = construirIndice(curtas, new Map(curtas.map((c) => [c.notaId, { titulo: `S${c.notaId}` }])), []);
    expect(indice.total).toBe(300);
    expect(indice.entradas).toHaveLength(120);
    expect(indice.entradas[0].id).toBe("300");
  });

  it("ignora sínteses cuja nota não está mais acessível", () => {
    const indice = construirIndice([conceito(1), conceito(2)], new Map([["1", { id: "1", titulo: "Síntese 1", pasta: null } as ResumoDeNota]]), []);
    expect(indice).toMatchObject({ total: 1, entradas: [{ id: "1", titulo: "Síntese 1" }] });
  });
});

describe("o modelo recebe o índice e pode apontar qualquer síntese dele", () => {
  async function comUmaSintese() {
    const repo = criarRepositorioEmMemoria([{ titulo: "Cache", conteudo: "O cache guarda cópias locais dos dados." }]);
    vi.advanceTimersByTime(ESPERA);
    await rodar(repo, async (c) => ({ proposta: { propostas: [proposta("Consistência de caches", c.origem.id, "O cache guarda cópias locais", { aliases: ["coerência de cache"] })] }, uso: null }));
    const [pagina] = await repo.wiki!.listar();
    return { repo, id: pagina.notaId };
  }

  it("o payload traz título e aliases de todas as sínteses, sem o conteúdo delas", async () => {
    const { repo, id } = await comUmaSintese();
    await repo.criarNota({ titulo: "Aeroportos", conteudo: "A pista principal fica fechada durante a manutenção noturna." }, { criadoPor: "usuario" });
    vi.advanceTimersByTime(ESPERA);
    let visto: ContextoWiki | undefined;
    await rodar(repo, async (c) => { visto = c; return vazio; });
    const enviado = entradaDaDescoberta(visto!);
    expect(enviado.indice).toEqual({ total: 1, entradas: [{ id, titulo: "Consistência de caches", aliases: ["coerência de cache"], protegida: false }] });
    expect(JSON.stringify(enviado.indice)).not.toContain("cópias locais");
  });

  it("enriquece uma síntese escolhida pelo índice mesmo quando a recuperação não a trouxe", async () => {
    const { repo, id } = await comUmaSintese();
    await repo.criarNota({ titulo: "Aeroportos", conteudo: "A pista principal fica fechada durante a manutenção noturna." }, { criadoPor: "usuario" });
    vi.advanceTimersByTime(ESPERA);
    const r = await rodar(repo, async (c) => {
      expect(c.candidatas.some((v) => v.nota.id === id)).toBe(false);
      const alvo = c.indice.entradas.find((e) => e.titulo === "Consistência de caches")!;
      return { proposta: { propostas: [proposta("Consistência de caches", c.origem.id, "A pista principal fica fechada", { alvoId: alvo.id })] }, uso: null };
    });
    expect(r).toMatchObject({ tipo: "processado", publicadas: 1, descartadas: 0 });
    expect(await repo.wiki!.listar()).toHaveLength(1);
    expect((await repo.wiki!.obter(id))?.afirmacoes).toHaveLength(2);
  });

  it("um id do índice com proposta de outro assunto é recusado, em vez de contaminar a síntese", async () => {
    const { repo, id } = await comUmaSintese();
    await repo.criarNota({ titulo: "Aeroportos", conteudo: "A pista principal fica fechada durante a manutenção noturna." }, { criadoPor: "usuario" });
    vi.advanceTimersByTime(ESPERA);
    const r = await rodar(repo, async (c) => ({ proposta: { propostas: [proposta("Manutenção de pistas", c.origem.id, "A pista principal fica fechada", { alvoId: id })] }, uso: null }));
    expect(r).toMatchObject({ publicadas: 0, descartadas: 1 });
    expect((await repo.wiki!.obter(id))?.afirmacoes).toHaveLength(1);
  });

  it("um alvo que não está no índice nem entre as candidatas continua sendo recusado", async () => {
    const { repo } = await comUmaSintese();
    await repo.criarNota({ titulo: "Aeroportos", conteudo: "A pista principal fica fechada durante a manutenção noturna." }, { criadoPor: "usuario" });
    vi.advanceTimersByTime(ESPERA);
    const r = await rodar(repo, async (c) => ({ proposta: { propostas: [proposta("Outra", c.origem.id, "A pista principal fica fechada", { alvoId: "9999" })] }, uso: null }));
    expect(r).toMatchObject({ tipo: "processado", publicadas: 0, descartadas: 1 });
  });

  it("uma síntese protegida (editada à mão) escolhida pelo índice não é alterada", async () => {
    const { repo, id } = await comUmaSintese();
    await repo.atualizarNota(id, { conteudo: "minha versão" }, { revisaoBase: 1, autor: { criadoPor: "usuario" } });
    await repo.criarNota({ titulo: "Aeroportos", conteudo: "A pista principal fica fechada durante a manutenção noturna." }, { criadoPor: "usuario" });
    vi.advanceTimersByTime(ESPERA);
    const r = await rodar(repo, async (c) => {
      const alvo = c.indice.entradas.find((e) => e.id === id)!;
      expect(alvo.protegida).toBe(true);
      return { proposta: { propostas: [proposta("Consistência de caches", c.origem.id, "A pista principal fica fechada", { alvoId: id })] }, uso: null };
    });
    expect(r).toMatchObject({ tipo: "processado", publicadas: 0, descartadas: 1 });
    expect((await repo.obterNota(id))?.conteudo).toBe("minha versão");
  });

  it("uma nota pessoal escolhida como alvo é recusada, mesmo sendo candidata", async () => {
    const repo = criarRepositorioEmMemoria([
      { titulo: "Cache", conteudo: "O cache guarda cópias locais dos dados." },
      { titulo: "Cache remoto", conteudo: "O cache remoto guarda cópias dos dados em outro servidor." },
    ]);
    vi.advanceTimersByTime(ESPERA);
    let escolhida = "";
    const r = await rodar(repo, async (c) => {
      escolhida = c.candidatas[0]?.nota.id ?? "";
      return { proposta: { propostas: [proposta("Cache", c.origem.id, "O cache guarda cópias locais", { alvoId: escolhida })] }, uso: null };
    });
    expect(escolhida).not.toBe("");
    expect(r).toMatchObject({ publicadas: 0, descartadas: 1 });
    expect(await repo.wiki!.listar()).toHaveLength(0);
  });

  it("dependentes além da onda não viram avaliadas só porque a pontuação as trouxe como candidatas", async () => {
    const repo = criarRepositorioEmMemoria([{ titulo: "Cache", conteudo: "O cache guarda cópias locais e remotas e antigas." }]);
    const criar = (nomes: string[], citacao: string) => async (c: ContextoWiki) => ({ proposta: { propostas: nomes.map((n) => proposta(`Conceito ${n}`, c.origem.id, citacao)) }, uso: null });
    vi.advanceTimersByTime(ESPERA);
    await rodar(repo, criar(["Alfa", "Beta", "Gama"], "O cache guarda cópias locais"));
    await repo.atualizarNota("1", { conteudo: "O cache guarda cópias locais e remotas." }, { revisaoBase: 1, autor: { criadoPor: "usuario" } }); vi.advanceTimersByTime(ESPERA);
    await rodar(repo, criar(["Delta", "Epsilon", "Zeta"], "O cache guarda cópias locais e remotas"));
    await repo.atualizarNota("1", { conteudo: "O cache guarda cópias locais e remotas, hoje." }, { revisaoBase: 2, autor: { criadoPor: "usuario" } }); vi.advanceTimersByTime(ESPERA);
    // O modelo atualiza só as dependentes garantidas e ignora as outras candidatas que a pontuação trouxe.
    const gerar = vi.fn<GeradorAutomaticoWiki>(async (c) => ({ proposta: { propostas: c.dependentes.map((id) =>
      proposta("Atualização", c.origem.id, "O cache guarda cópias locais e remotas, hoje", { alvoId: id })) }, uso: { entrada: 1, saida: 1 } }));
    await rodar(repo, gerar);
    expect((await repo.wiki!.automacao!.cobertura()).concluidos).toBe(0);
    expect((await repo.wiki!.automacao!.conceitos()).filter((c) => c.origens["1"] === 3)).toHaveLength(3);
    vi.advanceTimersByTime(1_000);
    await rodar(repo, gerar);
    expect(gerar).toHaveBeenCalledTimes(2);
    expect((await repo.wiki!.automacao!.cobertura()).concluidos).toBe(1);
    expect((await repo.wiki!.automacao!.conceitos()).every((c) => c.origens["1"] === 3)).toBe(true);
  });

  it("um título igual a um apelido de síntese existente enriquece a síntese em vez de duplicá-la", async () => {
    const { repo, id } = await comUmaSintese();
    await repo.criarNota({ titulo: "Invalidação", conteudo: "Invalidar o cache cedo demais gera tráfego desnecessário." }, { criadoPor: "usuario" });
    vi.advanceTimersByTime(ESPERA);
    await rodar(repo, async (c) => ({ proposta: { propostas: [proposta("Coerência de cache", c.origem.id, "Invalidar o cache cedo demais")] }, uso: null }));
    expect(await repo.wiki!.listar()).toHaveLength(1);
    expect((await repo.wiki!.obter(id))?.afirmacoes).toHaveLength(2);
  });
});

describe("candidatas pelos termos característicos", () => {
  const comuns = "sistema dados processo informacao resultado ambiente projeto arquivo servico usuario modelo camada";
  const geral = (n: number) => ({ titulo: `Nota geral ${n}`, conteudo: `${comuns} registro ${n}.` });

  it("traz a nota do termo raro que aparece no fim, não as notas que só repetem palavras comuns", async () => {
    const repo = criarRepositorioEmMemoria([
      ...Array.from({ length: 14 }, (_, i) => geral(i + 1)),
      { titulo: "Raft", conteudo: "O Raft usa quórum de maioria para eleger o líder." },
      // A palavra comum é a mais repetida; só a raridade no acervo põe "quórum" na frente.
      { titulo: "Replicação", conteudo: `${comuns}. Sistema sistema sistema sistema sistema sistema. O quórum decide. Quórum de escrita. Quórum de leitura.` },
    ]);
    vi.advanceTimersByTime(ESPERA);
    let visto: ContextoWiki | undefined;
    const gerar: GeradorAutomaticoWiki = async (c) => { if (c.origem.titulo === "Replicação") visto = c; return vazio; };
    for (let i = 0; i < 20 && !visto; i++) { await rodar(repo, gerar); vi.advanceTimersByTime(1_000); }
    const titulos = visto!.candidatas.map((v) => v.nota.titulo);
    expect(titulos).toContain("Raft");
    expect(titulos.indexOf("Raft")).toBeLessThan(2);
    expect(titulos.length).toBeLessThanOrEqual(6);
  });

  it("termos exclusivos da própria nota não esgotam a lista: os seguintes ainda recuperam", async () => {
    // Doze termos próprios e salientes; "TCP", menos repetido, é o que existe em outra nota.
    const proprios = Array.from({ length: 12 }, (_, i) => `exclusivo${String.fromCharCode(97 + i)}${String.fromCharCode(97 + i)}`.repeat(1)).map((t) => `${t} ${t} ${t}`).join(" ");
    const repo = criarRepositorioEmMemoria([
      { titulo: "Protocolo TCP", conteudo: "Protocolo TCP é orientado a conexão." },
      { titulo: "Origem", conteudo: `${proprios} TCP.` },
    ]);
    vi.advanceTimersByTime(ESPERA);
    let visto: ContextoWiki | undefined;
    for (let i = 0; i < 6 && !visto; i++) { await rodar(repo, async (c) => { if (c.origem.titulo === "Origem") visto = c; return vazio; }); vi.advanceTimersByTime(1_000); }
    expect(visto!.candidatas.map((v) => v.nota.titulo)).toContain("Protocolo TCP");
  });

  it("uma sigla de três letras é termo de recuperação", async () => {
    const repo = criarRepositorioEmMemoria([
      { titulo: "Protocolo TCP", conteudo: "Protocolo TCP é orientado a conexão." },
      { titulo: "Congestionamento", conteudo: "O TCP controla congestionamento. TCP usa janelas. TCP e TCP." },
    ]);
    vi.advanceTimersByTime(ESPERA);
    let visto: ContextoWiki | undefined;
    for (let i = 0; i < 6 && !visto; i++) { await rodar(repo, async (c) => { if (c.origem.titulo === "Congestionamento") visto = c; return vazio; }); vi.advanceTimersByTime(1_000); }
    expect(visto!.candidatas.map((v) => v.nota.titulo)).toContain("Protocolo TCP");
  });

  it("não consulta o acervo mais do que o limite de termos, com limite pequeno por consulta", async () => {
    const repo = criarRepositorioEmMemoria(Array.from({ length: 4 }, (_, i) => ({ titulo: `N${i}`, conteudo: `${comuns} alfa${i} beta${i} gama${i} delta${i}.` })));
    vi.advanceTimersByTime(ESPERA);
    const busca = vi.spyOn(repo, "buscarIdsPorConteudo");
    await rodar(repo, async () => vazio);
    expect(busca.mock.calls.length).toBeGreaterThan(0);
    expect(busca.mock.calls.length).toBeLessThanOrEqual(TERMOS_MAXIMOS);
    // A consulta pede um a mais que o limite de saturação, para a própria nota não esconder a saturação.
    expect(Math.max(...busca.mock.calls.map(([, limite]) => limite))).toBeLessThanOrEqual(21);
  });
});
