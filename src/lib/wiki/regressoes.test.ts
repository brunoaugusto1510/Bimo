// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { criarRepositorioEmMemoria } from "../repositorio-de-notas/memoria";
import { entradaDaDescoberta, processarWiki } from "./automacao";
import { evidenciasDaWiki } from "./consulta";
import type { GeradorAutomaticoWiki } from "./automacao-tipos";
import { ESTABILIDADE_DA_WIKI_SEGUNDOS } from "./configuracao";
import { executarFerramenta } from "../ferramentas";
import { estadoDaPagina } from "./servico";
import { ErroDaGeracaoWiki } from "./tipos";

const autor = { criadoPor: "usuario" as const };
const DIA = 86_400_000;
const ESPERA = (ESTABILIDADE_DA_WIKI_SEGUNDOS + 1) * 1000;
type Repo = ReturnType<typeof criarRepositorioEmMemoria>;
const proposta = (titulo: string, fonteId: string, ...citacoes: string[]) => ({ titulo, alvoId: null, aliases: [], lacunas: [],
  afirmacoes: citacoes.map((citacao) => ({ texto: `Sobre ${titulo}.`, natureza: "explicita" as const, evidencias: [{ fonteId, citacao }] })) });
const gerador = (...propostas: ((origem: string) => ReturnType<typeof proposta>)[]) =>
  vi.fn<GeradorAutomaticoWiki>(async (c) => ({ proposta: { propostas: propostas.map((p) => p(c.origem.id)) }, uso: { entrada: 1, saida: 1 } }));
const rodar = (repo: Repo, gerar: GeradorAutomaticoWiki, tetoDiario = 200_000) => processarWiki(repo, gerar, { tetoDiario });
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-22T12:00:00Z")); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe("fila e orçamento", () => {
  it("orçamento negado por vários dias não esgota as tentativas", async () => {
    const repo = criarRepositorioEmMemoria([{ titulo: "TCP", conteudo: "TCP garante entrega ordenada de bytes." }]);
    const gerar = gerador();
    vi.advanceTimersByTime(ESPERA);
    for (let dia = 0; dia < 4; dia++) {
      expect((await rodar(repo, gerar, 1)).tipo).toBe("orcamento");
      vi.advanceTimersByTime(DIA);
    }
    expect((await rodar(repo, gerar)).tipo).toBe("processado");
    expect(gerar).toHaveBeenCalledTimes(1);
  });

  it("um dono processa um trabalho por vez", async () => {
    const repo = criarRepositorioEmMemoria([{ titulo: "A", conteudo: "Primeira anotação." }, { titulo: "B", conteudo: "Segunda anotação." }]);
    vi.advanceTimersByTime(ESPERA);
    expect(await repo.wiki!.automacao!.reivindicar()).not.toBeNull();
    const gerar = gerador();
    expect((await rodar(repo, gerar)).tipo).toBe("ocioso");
    expect(gerar).not.toHaveBeenCalled();
  });

  it("recusa determinística do provedor não repete e libera a reserva", async () => {
    const repo = criarRepositorioEmMemoria([{ titulo: "A", conteudo: "Primeira anotação." }, { titulo: "B", conteudo: "Segunda anotação." }]);
    vi.advanceTimersByTime(ESPERA);
    const recusa = vi.fn<GeradorAutomaticoWiki>(async () => { throw Object.assign(new Error("Falha na API OpenAI (HTTP 400)."), { status: 400 }); });
    expect(await rodar(repo, recusa, 20_000)).toEqual({ tipo: "adiado", motivo: "revisar" });
    // Sem a liberação, a reserva incerta da primeira chamada impediria a segunda dentro do teto.
    expect((await rodar(repo, gerador(), 20_000)).tipo).toBe("processado");
    vi.advanceTimersByTime(DIA);
    expect((await rodar(repo, recusa)).tipo).toBe("ocioso");
    expect(recusa).toHaveBeenCalledTimes(1);
  });

  it("limite do provedor é transitório; resposta incompleta não se repete e contabiliza o uso real", async () => {
    const repo = criarRepositorioEmMemoria([{ titulo: "A", conteudo: "Primeira anotação." }]);
    vi.advanceTimersByTime(ESPERA);
    expect(await rodar(repo, async () => { throw Object.assign(new Error("limite"), { status: 429 }); })).toEqual({ tipo: "adiado", motivo: "temporario" });
    vi.advanceTimersByTime(60_000);
    const incompleta = vi.fn<GeradorAutomaticoWiki>(async () => { throw new ErroDaGeracaoWiki("incompleta", { entrada: 10, saida: 5 }); });
    expect(await rodar(repo, incompleta)).toEqual({ tipo: "adiado", motivo: "revisar" });
    const fila = repo.wiki!.automacao!;
    await repo.criarNota({ titulo: "B", conteudo: "Outra anotação." }, autor); vi.advanceTimersByTime(ESPERA);
    const t = (await fila.reivindicar())!;
    // Só 15 tokens confirmados: cabe uma nova reserva de quase todo o teto.
    expect(await fila.reservar(t, 99_985, 100_000)).not.toBeNull();
  });

  it("registra no servidor só a categoria da falha, sem texto das notas", async () => {
    const registro = vi.spyOn(console, "error").mockImplementation(() => {});
    const repo = criarRepositorioEmMemoria([{ titulo: "A", conteudo: "conteúdo confidencial" }]);
    vi.advanceTimersByTime(ESPERA);
    await rodar(repo, async (c) => { throw new Error(`falhou com ${c.trecho.texto}`); });
    expect(registro).toHaveBeenCalled();
    expect(JSON.stringify(registro.mock.calls)).toContain("temporario");
    expect(JSON.stringify(registro.mock.calls)).not.toContain("confidencial");
  });
});

describe("validação por proposta", () => {
  it("síntese com o título da nota de origem é desambiguada em vez de repetir chamadas", async () => {
    const repo = criarRepositorioEmMemoria([{ titulo: "TCP", pasta: "Estudos", conteudo: "TCP garante entrega ordenada de bytes." }]);
    const gerar = gerador((id) => proposta("TCP", id, "garante entrega ordenada"));
    vi.advanceTimersByTime(ESPERA);
    expect(await rodar(repo, gerar)).toMatchObject({ tipo: "processado", publicadas: 1 });
    const [pagina] = await repo.wiki!.listar();
    expect((await repo.obterNota(pagina.notaId))?.titulo).toBe("TCP (síntese)");
    expect((await repo.wiki!.automacao!.conceitos())[0].chave).toBe("tcp");
    expect(gerar).toHaveBeenCalledTimes(1);
  });

  it("caracteres proibidos no título são trocados em vez de descartar a proposta", async () => {
    const repo = criarRepositorioEmMemoria([{ titulo: "Redes", conteudo: "A pilha TCP/IP tem quatro camadas." }]);
    vi.advanceTimersByTime(ESPERA);
    await rodar(repo, gerador((id) => proposta("TCP/IP", id, "A pilha TCP/IP tem quatro camadas")));
    const [pagina] = await repo.wiki!.listar();
    expect((await repo.obterNota(pagina.notaId))?.titulo).toBe("TCP-IP");
  });

  it("uma proposta inválida não descarta as válidas nem trava a nota", async () => {
    const repo = criarRepositorioEmMemoria([{ titulo: "Nota", conteudo: "TCP garante entrega ordenada. UDP não garante." }]);
    vi.advanceTimersByTime(ESPERA);
    const r = await rodar(repo, gerador(
      (id) => proposta("Transporte confiável", id, "TCP garante entrega ordenada"),
      (id) => proposta("Datagramas", id, "UDP não garante a entrega"),
    ));
    expect(r).toMatchObject({ tipo: "processado", publicadas: 1, descartadas: 1 });
    expect(await repo.wiki!.listar()).toHaveLength(1);
    expect((await repo.wiki!.automacao!.cobertura()).concluidos).toBe(1);
  });

  it("descarta só a afirmação sem suporte e mantém as sustentadas", async () => {
    const repo = criarRepositorioEmMemoria([{ titulo: "Nota", conteudo: "TCP garante entrega ordenada. UDP é mais leve." }]);
    vi.advanceTimersByTime(ESPERA);
    await rodar(repo, gerador((id) => proposta("Transporte", id, "TCP garante entrega ordenada", "texto que não existe na nota")));
    const [pagina] = await repo.wiki!.listar();
    expect(pagina.afirmacoes).toHaveLength(1);
  });

  it("citação curta demais não serve de evidência", async () => {
    const repo = criarRepositorioEmMemoria([{ titulo: "Nota", conteudo: "Bolo de cenoura leva três ovos." }]);
    vi.advanceTimersByTime(ESPERA);
    expect(await rodar(repo, gerador((id) => proposta("Física quântica", id, "a")))).toMatchObject({ tipo: "processado", publicadas: 0 });
    expect(await repo.wiki!.listar()).toHaveLength(0);
    expect((await repo.wiki!.automacao!.cobertura()).concluidos).toBe(1);
  });

  it("aceita citação com espaços e aspas normalizados e guarda o trecho original", async () => {
    const original = "O  cache\nfica “velho” muito rápido.";
    const repo = criarRepositorioEmMemoria([{ titulo: "Nota", conteudo: original }]);
    vi.advanceTimersByTime(ESPERA);
    await rodar(repo, gerador((id) => proposta("Cache", id, "O cache fica \"velho\" muito rápido")));
    const [pagina] = await repo.wiki!.listar();
    const evidencia = pagina.afirmacoes[0].evidencias[0];
    expect(original.slice(evidencia.inicio, evidencia.fim)).toBe(evidencia.citacao);
    expect(evidencia.citacao).toBe("O  cache\nfica “velho” muito rápido");
  });
});

describe("janela de estabilidade e organização", () => {
  it("autosaves com pausas curtas viram uma chamada só", async () => {
    const repo = criarRepositorioEmMemoria();
    const criada = await repo.criarNota({ titulo: "Rascunho", conteudo: "" }, autor);
    if (criada.tipo !== "ok") throw new Error("criação falhou");
    const gerar = gerador();
    let revisao = criada.nota.revisao; let texto = "";
    for (const frase of ["Pensando sobre cache. ", "Ele fica velho. ", "Talvez TTL resolva. ", "Ou invalidação."]) {
      texto += frase;
      const r = await repo.atualizarNota(criada.nota.id, { conteudo: texto }, { revisaoBase: revisao, autor });
      if (r.tipo === "ok") revisao = r.nota.revisao;
      vi.advanceTimersByTime(6_000);
      await rodar(repo, gerar);
    }
    vi.advanceTimersByTime(ESPERA);
    await rodar(repo, gerar);
    expect(gerar).toHaveBeenCalledTimes(1);
    expect(gerar.mock.calls[0][0].trecho.texto).toBe(texto);
  });

  it("renomear, mover e reescrever ligações não reprocessa a nota", async () => {
    const repo = criarRepositorioEmMemoria([
      { titulo: "TCP", conteudo: "TCP garante entrega ordenada de bytes." },
      { titulo: "Índice", conteudo: "Veja [[TCP]]." },
    ]);
    vi.advanceTimersByTime(ESPERA);
    const gerar = gerador();
    await rodar(repo, gerar); await rodar(repo, gerar);
    expect(gerar).toHaveBeenCalledTimes(2);
    await repo.renomearNota("1", "Protocolo TCP", { revisaoBase: 1, autor });
    await repo.atualizarNota("1", { pasta: "Redes" }, { revisaoBase: 2, autor });
    vi.advanceTimersByTime(ESPERA);
    expect((await rodar(repo, gerar)).tipo).toBe("ocioso");
    expect(gerar).toHaveBeenCalledTimes(2);
  });

  it("dependentes que o modelo não atualiza não geram repetição paga", async () => {
    const repo = criarRepositorioEmMemoria([{ titulo: "Cache", conteudo: "O cache guarda cópias locais." }]);
    vi.advanceTimersByTime(ESPERA);
    await rodar(repo, gerador((id) => proposta("Consistência", id, "O cache guarda cópias locais")));
    const [pagina] = await repo.wiki!.listar();
    await repo.atualizarNota("1", { conteudo: "O cache guarda cópias remotas." }, { revisaoBase: 1, autor });
    vi.advanceTimersByTime(ESPERA);
    const gerar = gerador();
    expect((await rodar(repo, gerar)).tipo).toBe("processado");
    expect((await rodar(repo, gerar)).tipo).toBe("ocioso");
    expect(gerar).toHaveBeenCalledTimes(1);
    expect((await repo.wiki!.automacao!.cobertura()).concluidos).toBe(1);
    // A síntese não foi revalidada: o agente continua sendo avisado.
    expect(await estadoDaPagina(repo, (await repo.wiki!.obter(pagina.notaId))!)).toBe("desatualizada");
  });
});

describe("estado da página", () => {
  it("renomear ou mover uma síntese não a faz parecer editada à mão", async () => {
    const repo = criarRepositorioEmMemoria([{ titulo: "Nota", conteudo: "TCP garante entrega ordenada." }]);
    vi.advanceTimersByTime(ESPERA);
    await rodar(repo, gerador((id) => proposta("Transporte confiável", id, "TCP garante entrega ordenada")));
    const [meta] = await repo.wiki!.listar();
    await repo.renomearNota(meta.notaId, "Transporte confiável (TCP)", { revisaoBase: 1, autor });
    await repo.atualizarNota(meta.notaId, { pasta: "Conceitos" }, { revisaoBase: 2, autor });
    expect(await estadoDaPagina(repo, (await repo.wiki!.obter(meta.notaId))!)).toBe("atualizada");
    expect((await repo.wiki!.automacao!.conceitos())[0].protegida).toBe(false);
  });

  it("renomear a nota de origem mantém a síntese atual", async () => {
    const repo = criarRepositorioEmMemoria([{ titulo: "Nota", conteudo: "TCP garante entrega ordenada." }]);
    vi.advanceTimersByTime(ESPERA);
    await rodar(repo, gerador((id) => proposta("Transporte confiável", id, "TCP garante entrega ordenada")));
    const [meta] = await repo.wiki!.listar();
    await repo.renomearNota("1", "Anotação sobre TCP", { revisaoBase: 1, autor });
    expect(await estadoDaPagina(repo, (await repo.wiki!.obter(meta.notaId))!)).toBe("atualizada");
  });

  it("editar o conteúdo continua protegendo a síntese", async () => {
    const repo = criarRepositorioEmMemoria([{ titulo: "Nota", conteudo: "TCP garante entrega ordenada." }]);
    vi.advanceTimersByTime(ESPERA);
    await rodar(repo, gerador((id) => proposta("Transporte confiável", id, "TCP garante entrega ordenada")));
    const [meta] = await repo.wiki!.listar();
    await repo.atualizarNota(meta.notaId, { conteudo: "minha versão" }, { revisaoBase: 1, autor });
    expect(await estadoDaPagina(repo, (await repo.wiki!.obter(meta.notaId))!)).toBe("edicao_manual");
  });
});

describe("achados da segunda revisão", () => {
  it("renomear uma nota linkada por uma origem não degrada a síntese nem as evidências", async () => {
    const repo = criarRepositorioEmMemoria([
      { titulo: "TCP", conteudo: "TCP garante entrega ordenada de bytes. Ver [[UDP]]." },
      { titulo: "UDP", conteudo: "UDP é mais leve." },
    ]);
    vi.advanceTimersByTime(ESPERA);
    await rodar(repo, gerador((id) => proposta("Transporte confiável", id, "TCP garante entrega ordenada de bytes")));
    const [meta] = await repo.wiki!.listar();
    await repo.renomearNota("2", "Datagramas UDP", { revisaoBase: 1, autor });
    expect((await repo.obterNota("1"))?.conteudo).toContain("[[Datagramas UDP]]");
    expect(await estadoDaPagina(repo, (await repo.wiki!.obter(meta.notaId))!)).toBe("atualizada");
    const evidencias = await evidenciasDaWiki(repo, meta.notaId);
    expect(evidencias?.afirmacoes).toHaveLength(1);
  });

  it("cancelamento antes de chamar o provedor não deixa reserva incerta", async () => {
    const repo = criarRepositorioEmMemoria([{ titulo: "A", conteudo: "Primeira anotação." }]);
    vi.advanceTimersByTime(ESPERA);
    const controle = new AbortController(); controle.abort();
    const gerar = gerador();
    const r = await processarWiki(repo, gerar, { tetoDiario: 20_000, sinal: controle.signal });
    expect(r.tipo).toBe("adiado");
    expect(gerar).not.toHaveBeenCalled();
    const fila = repo.wiki!.automacao!;
    vi.advanceTimersByTime(60_000);
    const t = (await fila.reivindicar())!;
    expect(await fila.reservar(t, 19_000, 20_000)).not.toBeNull();
  });

  it("síntese cuja atualização foi descartada não conta como avaliada", async () => {
    const repo = criarRepositorioEmMemoria([{ titulo: "Cache", conteudo: "O cache guarda cópias locais." }]);
    vi.advanceTimersByTime(ESPERA);
    await rodar(repo, gerador((id) => proposta("Consistência", id, "O cache guarda cópias locais")));
    await repo.atualizarNota("1", { conteudo: "O cache guarda cópias remotas." }, { revisaoBase: 1, autor });
    vi.advanceTimersByTime(ESPERA);
    const gerar = vi.fn<GeradorAutomaticoWiki>(async (c) => {
      const alvo = c.candidatas.find((v) => v.conceito)!;
      expect(entradaDaDescoberta(c).candidatas.find((v) => v.id === alvo.nota.id)?.desatualizadaPelaOrigem).toBe(true);
      // A proposta de atualização cita um trecho que não existe: é descartada.
      return { proposta: { propostas: [{ ...proposta("Consistência", c.origem.id, "trecho que não existe na nota"), alvoId: alvo.nota.id }] }, uso: { entrada: 1, saida: 1 } };
    });
    expect(await rodar(repo, gerar)).toMatchObject({ tipo: "processado", publicadas: 0, descartadas: 1 });
    expect((await repo.wiki!.automacao!.conceitos())[0].origens).toEqual({ "1": 1 });
  });

  it("erro do provedor travado em 'revisar' reabre com --retomar; revisar editorial não", async () => {
    const repo = criarRepositorioEmMemoria([{ titulo: "A", conteudo: "Primeira anotação." }]);
    vi.advanceTimersByTime(ESPERA);
    const fila = repo.wiki!.automacao!;
    const recusa = Object.assign(new Error("Falha na API OpenAI (HTTP 404)."), { status: 404, name: "ErroOpenAI" });
    expect(await rodar(repo, async () => { throw recusa; })).toEqual({ tipo: "adiado", motivo: "revisar" });
    await fila.retomar(); vi.advanceTimersByTime(60_000);
    expect((await rodar(repo, gerador())).tipo).toBe("processado");
  });

  it("dependente vista e não atualizada conclui a origem em uma chamada, mesmo com conceito novo publicado", async () => {
    const repo = criarRepositorioEmMemoria([{ titulo: "Cache", conteudo: "O cache guarda cópias locais." }]);
    vi.advanceTimersByTime(ESPERA);
    await rodar(repo, gerador((id) => proposta("Consistência", id, "O cache guarda cópias locais")));
    await repo.atualizarNota("1", { conteudo: "O cache guarda cópias remotas." }, { revisaoBase: 1, autor });
    vi.advanceTimersByTime(ESPERA);
    let n = 0;
    const gerar = vi.fn<GeradorAutomaticoWiki>(async (c) => ({ proposta: { propostas: [proposta(`Conceito ${++n} do cache`, c.origem.id, "O cache guarda cópias remotas")] }, uso: { entrada: 1, saida: 1 } }));
    for (let i = 0; i < 4; i++) { await rodar(repo, gerar); vi.advanceTimersByTime(10 * 60_000); }
    expect(gerar).toHaveBeenCalledTimes(1);
    expect((await repo.wiki!.automacao!.cobertura()).concluidos).toBe(1);
  });

  it("com mais dependentes que cabem numa onda, o modelo as vê em ondas e a origem conclui", async () => {
    const repo = criarRepositorioEmMemoria([{ titulo: "Cache", conteudo: "O cache guarda cópias locais e remotas e antigas." }]);
    const criar = (nomes: string[], citacao: string) => gerador(...nomes.map((nome) => (id: string) => proposta(`Conceito ${nome}`, id, citacao)));
    vi.advanceTimersByTime(ESPERA);
    await rodar(repo, criar(["Alfa", "Beta", "Gama"], "O cache guarda cópias locais"));
    await repo.atualizarNota("1", { conteudo: "O cache guarda cópias locais e remotas." }, { revisaoBase: 1, autor }); vi.advanceTimersByTime(ESPERA);
    await rodar(repo, criar(["Delta", "Epsilon", "Zeta"], "O cache guarda cópias locais e remotas"));
    expect(await repo.wiki!.automacao!.conceitos()).toHaveLength(6);
    await repo.atualizarNota("1", { conteudo: "O cache guarda cópias locais e remotas, hoje." }, { revisaoBase: 2, autor }); vi.advanceTimersByTime(ESPERA);
    const vistas = new Set<string>();
    const gerar = vi.fn<GeradorAutomaticoWiki>(async (c) => {
      c.candidatas.filter((v) => v.conceito?.origens["1"] === 2).forEach((v) => vistas.add(v.nota.id));
      return { proposta: { propostas: [] }, uso: { entrada: 1, saida: 1 } };
    });
    for (let i = 0; i < 6; i++) { await rodar(repo, gerar); vi.advanceTimersByTime(10 * 60_000); }
    expect(vistas.size).toBe(6);
    expect(gerar).toHaveBeenCalledTimes(2);
    expect((await repo.wiki!.automacao!.cobertura()).concluidos).toBe(1);
  });
});

describe("achados da revisão do Codex", () => {
  it("uma proposta malformada não derruba as válidas", async () => {
    const repo = criarRepositorioEmMemoria([{ titulo: "Nota", conteudo: "TCP garante entrega ordenada de bytes." }]);
    vi.advanceTimersByTime(ESPERA);
    const gerar = vi.fn<GeradorAutomaticoWiki>(async (c) => ({ proposta: { propostas: [
      { ...proposta("   ", c.origem.id, "TCP garante entrega ordenada"), titulo: "   " },
      proposta("Transporte confiável", c.origem.id, "TCP garante entrega ordenada de bytes"),
    ] }, uso: { entrada: 1, saida: 1 } }));
    expect(await rodar(repo, gerar)).toMatchObject({ tipo: "processado", publicadas: 1, descartadas: 1 });
    expect(await repo.wiki!.listar()).toHaveLength(1);
  });

  it("a citação lida no segundo trecho aponta para a ocorrência certa, não para a primeira da nota", async () => {
    const repetida = "A resposta final é quarenta e dois.";
    const conteudo = `${repetida}\n${"x".repeat(8_100)}\n${repetida} E depois disso, tudo mudou.`;
    const repo = criarRepositorioEmMemoria([{ titulo: "Longa", conteudo }]);
    vi.advanceTimersByTime(ESPERA);
    const gerar = vi.fn<GeradorAutomaticoWiki>(async (c) => ({ proposta: { propostas: c.trecho.inicio === 0 ? [] : [
      proposta("Resposta final", c.origem.id, "E depois disso, tudo mudou"),
    ] }, uso: { entrada: 1, saida: 1 } }));
    for (let i = 0; i < 3; i++) await rodar(repo, gerar);
    const [pagina] = await repo.wiki!.listar();
    const evidencia = pagina.afirmacoes[0].evidencias[0];
    expect(conteudo.slice(evidencia.inicio, evidencia.fim)).toBe("E depois disso, tudo mudou");
    expect(evidencia.inicio).toBeGreaterThan(8_000);
  });

  it("alterar só espaços na origem não apaga as afirmações anteriores ainda sustentadas", async () => {
    const repo = criarRepositorioEmMemoria([{ titulo: "Nota", conteudo: "TCP  garante entrega ordenada. UDP  é bem mais leve." }]);
    vi.advanceTimersByTime(ESPERA);
    await rodar(repo, gerador((id) => proposta("Transporte", id, "TCP  garante entrega ordenada", "UDP  é bem mais leve")));
    expect((await repo.wiki!.listar())[0].afirmacoes).toHaveLength(2);
    await repo.atualizarNota("1", { conteudo: "TCP garante entrega ordenada. UDP é bem mais leve. Novo trecho aqui." }, { revisaoBase: 1, autor });
    vi.advanceTimersByTime(ESPERA);
    await rodar(repo, async (c) => ({ proposta: { propostas: [{ ...proposta("Transporte", c.origem.id, "TCP garante entrega ordenada"), alvoId: c.candidatas.find((v) => v.conceito)!.nota.id }] }, uso: { entrada: 1, saida: 1 } }));
    const afirmacoes = (await repo.wiki!.listar())[0].afirmacoes;
    expect(afirmacoes.length).toBeGreaterThanOrEqual(2);
    for (const a of afirmacoes) for (const e of a.evidencias) expect("TCP garante entrega ordenada. UDP é bem mais leve. Novo trecho aqui.".slice(e.inicio, e.fim)).toBe(e.citacao);
  });
});

describe("a wiki não derruba as ferramentas de notas", () => {
  it("ler e buscar seguem funcionando quando a wiki falha", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const base = criarRepositorioEmMemoria([{ titulo: "TCP", conteudo: "TCP garante entrega ordenada." }]);
    const quebrada = new Error("tabela inexistente");
    const repositorio = { ...base, wiki: { ...base.wiki!, obter: async () => { throw quebrada; },
      automacao: { ...base.wiki!.automacao!, conceitos: async () => { throw quebrada; }, solicitar: async () => { throw quebrada; } } } };
    const lida = await executarFerramenta("ler_nota", { caminho: "TCP.md" }, { repositorio });
    expect(lida.erro).toBeUndefined();
    expect(lida.resposta).toMatchObject({ titulo: "TCP", conteudo: "TCP garante entrega ordenada." });
    const achada = await executarFerramenta("buscar_notas", { consulta: "entrega" }, { repositorio });
    expect(achada.erro).toBeUndefined();
    expect(achada.resposta).toMatchObject({ encontradas: 1 });
  });
});
