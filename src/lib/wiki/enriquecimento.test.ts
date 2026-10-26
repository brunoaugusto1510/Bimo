// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { criarRepositorioEmMemoria } from "../repositorio-de-notas/memoria";
import { entradaDaDescoberta, processarWiki } from "./automacao";
import type { ContextoWiki, GeradorAutomaticoWiki } from "./automacao-tipos";
import { LIMITE_DE_AFIRMACOES_VISIVEIS } from "./afirmacoes";
import { ESTABILIDADE_DA_WIKI_SEGUNDOS } from "./configuracao";
import type { AfirmacaoWiki } from "./tipos";

const ESPERA = (ESTABILIDADE_DA_WIKI_SEGUNDOS + 1) * 1000;
const autor = { criadoPor: "usuario" as const };
const rodar = (repo: ReturnType<typeof criarRepositorioEmMemoria>, gerar: GeradorAutomaticoWiki) => processarWiki(repo, gerar, { tetoDiario: 5_000_000 });
const afirmacao = (texto: string, fonteId: string, citacao: string) => ({ texto, natureza: "explicita" as "explicita" | "inferencia", evidencias: [{ fonteId, citacao }] });
type Proposta = { titulo: string; alvoId: string | null; aliases: string[]; lacunas: string[]; afirmacoes: ReturnType<typeof afirmacao>[];
  substituicoes?: { id: string; afirmacao: ReturnType<typeof afirmacao> }[]; retiradas?: string[] };
const proposta = (extras: Partial<Proposta>): Proposta => ({ titulo: "Regras do pedido", alvoId: null, aliases: [], lacunas: [], afirmacoes: [], ...extras });
const com = (...propostas: Proposta[]): GeradorAutomaticoWiki => async () => ({ proposta: { propostas }, uso: { entrada: 1, saida: 1 } });

const LIMITE_10 = "O limite de itens por pedido é 10";
const PRAZO = "O prazo de entrega é de 5 dias";
const LIMITE_20 = "o limite de itens por pedido passou a ser 20";
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-22T12:00:00Z")); });
afterEach(() => vi.useRealTimers());

async function comSintese() {
  // A terceira frase só é citada quando a nota é relida (ver `reler`).
  const repo = criarRepositorioEmMemoria([{ titulo: "Limites", conteudo: `${LIMITE_10}. ${PRAZO}. A partir de março ${LIMITE_20}.` }]);
  vi.advanceTimersByTime(ESPERA);
  await rodar(repo, async (c) => ({ proposta: { propostas: [proposta({ afirmacoes: [
    afirmacao("Limite de 10 itens", c.origem.id, LIMITE_10), afirmacao("Prazo de 5 dias", c.origem.id, PRAZO)] })] }, uso: null }));
  const [pagina] = await repo.wiki!.listar();
  const dela = (texto: string) => pagina.afirmacoes.find((a) => a.texto === texto) as AfirmacaoWiki;
  return { repo, id: pagina.notaId, limite10: dela("Limite de 10 itens"), prazo: dela("Prazo de 5 dias") };
}
async function novaNota(repo: ReturnType<typeof criarRepositorioEmMemoria>) {
  const r = await repo.criarNota({ titulo: "Atualização", conteudo: `A partir de março ${LIMITE_20}.` }, autor);
  vi.advanceTimersByTime(ESPERA);
  return r.tipo === "ok" ? r.nota.id : "";
}
/**
 * Só a nota que sustenta uma afirmação pode trocá-la ou retirá-la. Para testar a mecânica, a origem é relida: as afirmações
 * (todas dela, e ainda sustentadas) são mexidas pela própria nota. O contrário (outra nota tentando) tem seu teste abaixo.
 */
async function reler(repo: ReturnType<typeof criarRepositorioEmMemoria>) {
  expect(await repo.wiki!.automacao!.reprocessar("1", 1)).toBe("ok");
  vi.advanceTimersByTime(ESPERA);
  return "1";
}
const textos = async (repo: ReturnType<typeof criarRepositorioEmMemoria>, id: string) => (await repo.wiki!.obter(id))!.afirmacoes.map((a) => a.texto);

describe("ids de afirmação", () => {
  it("toda afirmação publicada tem um id único, e os ids das mantidas não mudam ao enriquecer", async () => {
    const { repo, id, limite10, prazo } = await comSintese();
    expect(new Set([limite10.id, prazo.id]).size).toBe(2);
    expect(limite10.id).toMatch(/^a[0-9a-f]{10}$/);
    const origem = await novaNota(repo);
    await rodar(repo, com(proposta({ alvoId: id, afirmacoes: [afirmacao("Limite de 20 itens a partir de março", origem, LIMITE_20)] })));
    const depois = (await repo.wiki!.obter(id))!.afirmacoes;
    expect(depois).toHaveLength(3);
    expect(depois.find((a) => a.texto === "Prazo de 5 dias")?.id).toBe(prazo.id);
    expect(new Set(depois.map((a) => a.id)).size).toBe(3);
  });

  it("o modelo vê o id das afirmações da candidata", async () => {
    const { repo, id, limite10 } = await comSintese();
    await novaNota(repo);
    let visto: ContextoWiki | undefined;
    await rodar(repo, async (c) => { visto = c; return { proposta: { propostas: [] }, uso: null }; });
    const candidata = entradaDaDescoberta(visto!).candidatas.find((v) => v.id === id)!;
    expect(candidata.afirmacoes?.map((a) => a.id)).toContain(limite10.id);
    expect(candidata.totalDeAfirmacoes).toBe(2);
  });
});

describe("enriquecer mantém, substitui ou retira", () => {
  it("substitui uma afirmação por id: a antiga sai mesmo com a evidência dela ainda existindo", async () => {
    const { repo, id, limite10 } = await comSintese();
    const origem = await reler(repo);
    const r = await rodar(repo, com(proposta({ alvoId: id, substituicoes: [{ id: limite10.id, afirmacao: afirmacao("Limite de 20 itens a partir de março", origem, LIMITE_20) }] })));
    expect(r).toMatchObject({ tipo: "processado", publicadas: 1, descartadas: 0 });
    expect(await textos(repo, id)).toEqual(expect.arrayContaining(["Prazo de 5 dias", "Limite de 20 itens a partir de março"]));
    expect(await textos(repo, id)).toHaveLength(2);
    const conteudo = (await repo.obterNota(id))!.conteudo;
    expect(conteudo).toContain("Limite de 20 itens");
    expect(conteudo).not.toContain("Limite de 10 itens");
  });

  it("retirar o que continua sustentado, sem nada no lugar, é ignorado: sem evidência não se apaga", async () => {
    const { repo, id, limite10 } = await comSintese();
    const antes = (await repo.obterNota(id))!;
    await novaNota(repo);
    const r = await rodar(repo, com(proposta({ alvoId: id, retiradas: [limite10.id] })));
    expect(r).toMatchObject({ publicadas: 0, descartadas: 1 });
    expect((await repo.obterNota(id))!.revisao).toBe(antes.revisao);
    expect(await textos(repo, id)).toHaveLength(2);
  });

  it("retira uma afirmação por id quando a nota traz uma afirmação nova no lugar", async () => {
    const { repo, id, limite10 } = await comSintese();
    const origem = await reler(repo);
    const r = await rodar(repo, com(proposta({ alvoId: id, retiradas: [limite10.id], afirmacoes: [afirmacao("Limite de 20 itens a partir de março", origem, LIMITE_20)] })));
    expect(r).toMatchObject({ publicadas: 1, descartadas: 0 });
    expect(await textos(repo, id)).toEqual(["Prazo de 5 dias", "Limite de 20 itens a partir de março"]);
    expect((await repo.obterNota(id))!.conteudo).not.toContain("Limite de 10 itens");
  });

  it("retirar tudo mas trazer uma afirmação nova é permitido", async () => {
    const { repo, id, limite10, prazo } = await comSintese();
    const origem = await reler(repo);
    await rodar(repo, com(proposta({ alvoId: id, retiradas: [limite10.id, prazo.id], afirmacoes: [afirmacao("Limite de 20 itens a partir de março", origem, LIMITE_20)] })));
    expect(await textos(repo, id)).toEqual(["Limite de 20 itens a partir de março"]);
  });

  it("outra nota não troca nem retira o que a nota de origem sustenta: o que ela traz é só acrescentado", async () => {
    const { repo, id, limite10, prazo } = await comSintese();
    const origem = await novaNota(repo);
    const r = await rodar(repo, com(proposta({ alvoId: id, retiradas: [prazo.id],
      substituicoes: [{ id: limite10.id, afirmacao: afirmacao("Limite de 20 itens a partir de março", origem, LIMITE_20) }],
      afirmacoes: [afirmacao("Há uma atualização do limite a partir de março", origem, LIMITE_20)] })));
    expect(r).toMatchObject({ publicadas: 1, descartadas: 0 });
    // Nada do que "Limites" afirma saiu; a divergência fica para o modelo registrar, não para esta nota resolver.
    expect(await textos(repo, id)).toEqual(["Limite de 10 itens", "Prazo de 5 dias", "Há uma atualização do limite a partir de março"]);
  });

  it("uma afirmação com evidência de duas notas só pode ser mexida por quem a sustenta sozinha: nenhuma das duas", async () => {
    const { repo, id, limite10 } = await comSintese();
    const origem = await novaNota(repo);
    // Reforça o limite com a nota nova: agora ele é sustentado por duas origens.
    await rodar(repo, com(proposta({ alvoId: id, reforcos: [{ id: limite10.id, evidencias: [{ fonteId: origem, citacao: LIMITE_20 }] }] } as Partial<Proposta>)));
    expect((await repo.wiki!.obter(id))!.afirmacoes.find((a) => a.id === limite10.id)!.evidencias).toHaveLength(2);
    // A releitura da origem original não pode retirá-la: a outra nota também a sustenta.
    await reler(repo);
    await rodar(repo, com(proposta({ alvoId: id, retiradas: [limite10.id], afirmacoes: [afirmacao("Limite de 20 itens a partir de março", "1", LIMITE_20)] })));
    expect(await textos(repo, id)).toContain("Limite de 10 itens");
  });

  it("ids desconhecidos são ignorados, sem derrubar o que é válido", async () => {
    const { repo, id } = await comSintese();
    const origem = await novaNota(repo);
    const r = await rodar(repo, com(proposta({ alvoId: id, retiradas: ["a-inexistente"],
      substituicoes: [{ id: "a-outro", afirmacao: afirmacao("Substituta órfã", origem, LIMITE_20) }],
      afirmacoes: [afirmacao("Limite de 20 itens a partir de março", origem, LIMITE_20)] })));
    expect(r).toMatchObject({ publicadas: 1, descartadas: 0 });
    expect(await textos(repo, id)).toHaveLength(3);
    expect(await textos(repo, id)).not.toContain("Substituta órfã");
  });

  it("substituição com evidência inválida mantém a afirmação antiga", async () => {
    const { repo, id, limite10 } = await comSintese();
    const origem = await novaNota(repo);
    await rodar(repo, com(proposta({ alvoId: id,
      substituicoes: [{ id: limite10.id, afirmacao: afirmacao("Limite de 20 itens", origem, "um trecho que a nota não tem") }],
      afirmacoes: [afirmacao("Limite de 20 itens a partir de março", origem, LIMITE_20)] })));
    expect(await textos(repo, id)).toEqual(expect.arrayContaining(["Limite de 10 itens", "Prazo de 5 dias", "Limite de 20 itens a partir de março"]));
    expect(await textos(repo, id)).not.toContain("Limite de 20 itens");
  });

  it("só uma operação inválida não muda nada e não vira publicação", async () => {
    const { repo, id } = await comSintese();
    const antes = (await repo.obterNota(id))!;
    const origem = await novaNota(repo);
    const r = await rodar(repo, com(proposta({ alvoId: id, retiradas: ["a-inexistente"], afirmacoes: [afirmacao("Sem suporte", origem, "trecho que não existe na nota nova")] })));
    expect(r).toMatchObject({ publicadas: 0, descartadas: 1 });
    expect((await repo.obterNota(id))!.revisao).toBe(antes.revisao);
  });

  it("repetir uma afirmação que já existe não duplica nem gera nova revisão", async () => {
    const { repo, id } = await comSintese();
    const antes = (await repo.obterNota(id))!;
    await novaNota(repo);
    const r = await rodar(repo, com(proposta({ alvoId: id, afirmacoes: [afirmacao("Limite de 10 itens", "1", LIMITE_10)] })));
    expect(r).toMatchObject({ publicadas: 0, descartadas: 1 });
    expect((await repo.obterNota(id))!.revisao).toBe(antes.revisao);
    expect(await textos(repo, id)).toHaveLength(2);
    // Sem mudança é uma decisão do modelo, não uma falha: a nota nova conclui.
    expect((await repo.wiki!.automacao!.cobertura()).concluidos).toBe(2);
  });

  it("proposta sem os campos novos continua valendo e só acrescenta", async () => {
    const { repo, id } = await comSintese();
    const origem = await novaNota(repo);
    const antiga = { titulo: "Regras do pedido", alvoId: id, aliases: [], lacunas: [], afirmacoes: [afirmacao("Limite de 20 itens a partir de março", origem, LIMITE_20)] };
    await rodar(repo, async () => ({ proposta: { propostas: [antiga] }, uso: null }));
    expect(await textos(repo, id)).toHaveLength(3);
  });

  it("uma síntese nova não aceita retiradas nem substituições, só afirmações", async () => {
    const repo = criarRepositorioEmMemoria([{ titulo: "Limites", conteudo: `${LIMITE_10}. ${PRAZO}.` }]);
    vi.advanceTimersByTime(ESPERA);
    await rodar(repo, async (c) => ({ proposta: { propostas: [proposta({ retiradas: ["a1"], afirmacoes: [afirmacao("Limite de 10 itens", c.origem.id, LIMITE_10)] })] }, uso: null }));
    expect(await repo.wiki!.listar()).toHaveLength(1);
    expect((await repo.wiki!.listar())[0].afirmacoes).toHaveLength(1);
  });

  it("síntese nova sem nenhuma afirmação sustentada não é criada", async () => {
    const repo = criarRepositorioEmMemoria([{ titulo: "Limites", conteudo: `${LIMITE_10}. ${PRAZO}.` }]);
    vi.advanceTimersByTime(ESPERA);
    expect(await rodar(repo, com(proposta({ afirmacoes: [] })))).toMatchObject({ publicadas: 0, descartadas: 1 });
    expect(await repo.wiki!.listar()).toHaveLength(0);
  });
});

describe("só se mexe no que o modelo viu", () => {
  it("retirada de um id que existe na síntese mas não foi mostrado é ignorada", async () => {
    const { repo, id, limite10, prazo } = await comSintese();
    const origem = await novaNota(repo);
    // Esconde as afirmações da candidata: o modelo não leu nenhuma, então não pode retirá-las por id.
    const gerar: GeradorAutomaticoWiki = async (c) => {
      for (const v of c.candidatas) if (v.metadados) v.metadados = { ...v.metadados, afirmacoes: [] };
      return { proposta: { propostas: [proposta({ alvoId: id, retiradas: [limite10.id, prazo.id], afirmacoes: [afirmacao("Limite de 20 itens a partir de março", origem, LIMITE_20)] })] }, uso: null };
    };
    await rodar(repo, gerar);
    expect(await textos(repo, id)).toEqual(expect.arrayContaining(["Limite de 10 itens", "Prazo de 5 dias"]));
  });

  it("o payload avisa o limite de afirmações por síntese", async () => {
    const { repo } = await comSintese();
    await novaNota(repo);
    let visto: ContextoWiki | undefined;
    await rodar(repo, async (c) => { visto = c; return { proposta: { propostas: [] }, uso: null }; });
    expect(entradaDaDescoberta(visto!).limiteDeAfirmacoes).toBe(72);
  });

  it("o id de uma afirmação de outra síntese não vale para a síntese alvo", async () => {
    const repo = criarRepositorioEmMemoria([{ titulo: "Limites", conteudo: `${LIMITE_10}. ${PRAZO}. A entrega usa transportadora própria.` }]);
    vi.advanceTimersByTime(ESPERA);
    await rodar(repo, async (c) => ({ proposta: { propostas: [
      proposta({ afirmacoes: [afirmacao("Limite de 10 itens", c.origem.id, LIMITE_10), afirmacao("Prazo de 5 dias", c.origem.id, PRAZO)] }),
      proposta({ titulo: "Logística de entrega", afirmacoes: [afirmacao("Transportadora própria", c.origem.id, "A entrega usa transportadora própria")] })] }, uso: null }));
    const paginas = await repo.wiki!.listar();
    const regras = paginas.find((p) => p.afirmacoes.some((a) => a.texto === "Prazo de 5 dias"))!;
    const logistica = paginas.find((p) => p !== regras)!;
    const origem = await novaNota(repo);
    await rodar(repo, com(proposta({ alvoId: regras.notaId, retiradas: [logistica.afirmacoes[0].id],
      afirmacoes: [afirmacao("Limite de 20 itens a partir de março", origem, LIMITE_20)] })));
    expect(await textos(repo, regras.notaId)).toHaveLength(3);
    expect(await textos(repo, logistica.notaId)).toEqual(["Transportadora própria"]);
  });

  it("só as 24 primeiras afirmações são mostradas; o id de uma além delas é ignorado", async () => {
    const frases = Array.from({ length: 30 }, (_, i) => `Fato número ${i + 1} do cadastro de clientes`);
    const repo = criarRepositorioEmMemoria([{ titulo: "Cadastro", conteudo: `${frases.slice(0, 24).join(". ")}.` }]);
    vi.advanceTimersByTime(ESPERA);
    await rodar(repo, async (c) => ({ proposta: { propostas: [proposta({ titulo: "Cadastro de clientes",
      afirmacoes: frases.slice(0, 24).map((f, i) => afirmacao(`Afirmação ${i + 1}`, c.origem.id, f)) })] }, uso: null }));
    const id = (await repo.wiki!.listar())[0].notaId;
    await repo.criarNota({ titulo: "Extras", conteudo: `${frases.slice(24).join(". ")}.` }, autor); vi.advanceTimersByTime(ESPERA);
    await rodar(repo, async (c) => ({ proposta: { propostas: [proposta({ titulo: "Cadastro de clientes", alvoId: id,
      afirmacoes: frases.slice(24).map((f, i) => afirmacao(`Afirmação ${i + 25}`, c.origem.id, f)) })] }, uso: null }));
    const trinta = (await repo.wiki!.obter(id))!.afirmacoes;
    expect(trinta).toHaveLength(30);
    const alem = trinta.find((a) => a.texto === "Afirmação 30")!;
    await repo.criarNota({ titulo: "Novos", conteudo: "Fato número 99 do cadastro de clientes novos." }, autor); vi.advanceTimersByTime(ESPERA);
    let visto: ContextoWiki | undefined;
    await rodar(repo, async (c) => {
      visto = c;
      return { proposta: { propostas: [proposta({ titulo: "Cadastro de clientes", alvoId: id, retiradas: [alem.id],
        afirmacoes: [afirmacao("Afirmação 99", c.origem.id, "Fato número 99 do cadastro de clientes novos")] })] }, uso: null };
    });
    const candidata = entradaDaDescoberta(visto!).candidatas.find((v) => v.id === id)!;
    expect(candidata.afirmacoes).toHaveLength(LIMITE_DE_AFIRMACOES_VISIVEIS);
    expect(candidata.totalDeAfirmacoes).toBe(30);
    expect(candidata.afirmacoes?.some((a) => a.id === alem.id)).toBe(false);
    const depois = await textos(repo, id);
    expect(depois).toContain("Afirmação 30");
    expect(depois).toContain("Afirmação 99");
  });

  it("afirmações gravadas antes dos ids ganham o mesmo id no payload e no servidor, e podem ser retiradas por ele", async () => {
    const { repo, id, limite10 } = await comSintese();
    const origem = await reler(repo);
    // Como estavam gravadas antes dos ids: o campo simplesmente não existe.
    const semId = (m: Awaited<ReturnType<NonNullable<typeof repo.wiki>["obter"]>>) => m && { ...m, afirmacoes: m.afirmacoes.map((a) => {
      const copia: Partial<AfirmacaoWiki> = { ...a }; delete copia.id; return copia as AfirmacaoWiki;
    }) };
    const legado = { ...repo, wiki: { ...repo.wiki!, obter: async (alvo: string) => semId(await repo.wiki!.obter(alvo)) } };
    let idVisto = "";
    await rodar(legado, async (c) => {
      const candidata = c.candidatas.find((v) => v.nota.id === id)!;
      idVisto = candidata.metadados!.afirmacoes.find((a) => a.texto === "Limite de 10 itens")!.id;
      return { proposta: { propostas: [proposta({ alvoId: id, retiradas: [idVisto], afirmacoes: [afirmacao("Limite de 20 itens a partir de março", origem, LIMITE_20)] })] }, uso: null };
    });
    expect(idVisto).toBe(limite10.id);
    expect(await textos(repo, id)).toEqual(["Prazo de 5 dias", "Limite de 20 itens a partir de março"]);
  });
});

describe("remoções e trocas em massa, e dependentes grandes", () => {
  const frases = Array.from({ length: 30 }, (_, i) => `Fato número ${i + 1} do cadastro de clientes`);
  /** Duas notas de origem (24 e 6 frases) e uma síntese de 30 afirmações. */
  async function comTrinta() {
    const repo = criarRepositorioEmMemoria([{ titulo: "Cadastro", conteudo: `${frases.slice(0, 24).join(". ")}.` }]);
    vi.advanceTimersByTime(ESPERA);
    await rodar(repo, async (c) => ({ proposta: { propostas: [proposta({ titulo: "Cadastro de clientes",
      afirmacoes: frases.slice(0, 24).map((f, i) => afirmacao(`Afirmação ${i + 1}`, c.origem.id, f)) })] }, uso: null }));
    const id = (await repo.wiki!.listar())[0].notaId;
    await repo.criarNota({ titulo: "Extras", conteudo: `${frases.slice(24).join(". ")}.` }, autor); vi.advanceTimersByTime(ESPERA);
    await rodar(repo, async (c) => ({ proposta: { propostas: [proposta({ titulo: "Cadastro de clientes", alvoId: id,
      afirmacoes: frases.slice(24).map((f, i) => afirmacao(`Afirmação ${i + 25}`, c.origem.id, f)) })] }, uso: null }));
    return { repo, id };
  }
  it("substituir várias afirmações pela mesma não colapsa a síntese", async () => {
    const { repo, id } = await comTrinta();
    expect(await textos(repo, id)).toHaveLength(30);
    await reler(repo);
    await rodar(repo, async (c) => {
      const mostradas = entradaDaDescoberta(c).candidatas.find((v) => v.id === id)!.afirmacoes!;
      return { proposta: { propostas: [proposta({ titulo: "Cadastro de clientes", alvoId: id,
        substituicoes: mostradas.map((a) => ({ id: a.id, afirmacao: afirmacao("Mesma afirmação", "1", frases[0]) })) })] }, uso: null };
    });
    const depois = await textos(repo, id);
    expect(depois).toHaveLength(30);
    expect(depois.filter((t) => t === "Mesma afirmação")).toHaveLength(1);
  });

  it("trocar de uma vez afirmações que continuam sustentadas tem teto por proposta", async () => {
    const { repo, id } = await comTrinta();
    await reler(repo);
    await rodar(repo, async (c) => {
      const mostradas = entradaDaDescoberta(c).candidatas.find((v) => v.id === id)!.afirmacoes!;
      return { proposta: { propostas: [proposta({ titulo: "Cadastro de clientes", alvoId: id,
        substituicoes: mostradas.map((a, i) => ({ id: a.id, afirmacao: afirmacao(`Novo ${i}`, "1", frases[i]) })) })] }, uso: null };
    });
    const depois = await textos(repo, id);
    expect(depois).toHaveLength(30);
    // 30 afirmações: até 8 trocas (um quarto, com no mínimo 3); as demais ficam como estavam.
    expect(depois.filter((t) => t.startsWith("Novo "))).toHaveLength(8);
    expect(depois.filter((t) => t.startsWith("Afirmação "))).toHaveLength(22);
  });

  it("uma dependente com mais afirmações desatualizadas do que o modelo vê não conta como avaliada", async () => {
    const { repo, id } = await comTrinta();
    // As duas origens mudam: as 30 afirmações ficam desatualizadas, e o modelo só vê 24 por chamada.
    await repo.atualizarNota("1", { conteudo: `${frases.slice(0, 24).join(". ")}. Revisado.` }, { revisaoBase: 1, autor });
    const extras = (await repo.listarResumos()).find((n) => n.titulo === "Extras")!.id;
    await repo.atualizarNota(extras, { conteudo: `${frases.slice(24).join(". ")}. Revisado.` }, { revisaoBase: 1, autor });
    vi.advanceTimersByTime(ESPERA);
    let visto: ContextoWiki | undefined;
    await rodar(repo, async (c) => { visto = c; return { proposta: { propostas: [proposta({ alvoId: id })] }, uso: null }; });
    const candidata = entradaDaDescoberta(visto!).candidatas.find((v) => v.id === id)!;
    expect(candidata.totalDeAfirmacoes).toBe(30);
    expect(candidata.afirmacoes).toHaveLength(LIMITE_DE_AFIRMACOES_VISIVEIS);
    expect(candidata.afirmacoes!.every((a) => "desatualizada" in a)).toBe(true);
    // O que ficou escondido continuaria sem revisão: a origem não conclui nem marca a síntese como em dia.
    expect((await repo.wiki!.automacao!.conceitos())[0].origens["1"]).toBe(1);
    expect((await repo.wiki!.automacao!.cobertura()).concluidos).toBe(0);
  });
});

describe("afirmações obsoletas e fidelidade da síntese", () => {
  /** A nota de origem muda: a evidência do limite continua no texto, mas com outro sentido. */
  async function origemEditada() {
    const ctx = await comSintese();
    await ctx.repo.atualizarNota("1", { conteudo: `${LIMITE_10} até março, depois 20. ${PRAZO}.` }, { revisaoBase: 1, autor });
    vi.advanceTimersByTime(ESPERA);
    return ctx;
  }

  it("o modelo vê, com id e marcadas como desatualizadas, as afirmações cuja origem mudou", async () => {
    const { repo, id, limite10 } = await origemEditada();
    let visto: ContextoWiki | undefined;
    await rodar(repo, async (c) => { visto = c; return { proposta: { propostas: [] }, uso: null }; });
    const candidata = entradaDaDescoberta(visto!).candidatas.find((v) => v.id === id)!;
    const limite = candidata.afirmacoes?.find((a) => a.id === limite10.id);
    expect(limite).toMatchObject({ texto: "Limite de 10 itens", desatualizada: true });
  });

  it("retirar todas as afirmações, mesmo desatualizadas e sem nada no lugar, deixaria a síntese vazia e é recusado", async () => {
    const { repo, id, limite10, prazo } = await origemEditada();
    const antes = (await repo.obterNota(id))!;
    const r = await rodar(repo, com(proposta({ alvoId: id, retiradas: [limite10.id, prazo.id] })));
    expect(r).toMatchObject({ publicadas: 0, descartadas: 1 });
    expect((await repo.obterNota(id))!.revisao).toBe(antes.revisao);
    expect(await textos(repo, id)).toHaveLength(2);
  });

  it("uma proposta de síntese existente sem nenhuma operação é uma decisão de não mudar: a síntese conta como avaliada", async () => {
    const { repo, id } = await origemEditada();
    const gerar = vi.fn(com(proposta({ alvoId: id })));
    expect(await rodar(repo, gerar)).toMatchObject({ tipo: "processado", publicadas: 0, descartadas: 1 });
    expect((await repo.wiki!.automacao!.conceitos())[0].origens["1"]).toBe(2);
    expect((await repo.wiki!.automacao!.cobertura()).concluidos).toBe(1);
    vi.advanceTimersByTime(ESPERA);
    expect((await rodar(repo, gerar)).tipo).toBe("ocioso");
    expect(gerar).toHaveBeenCalledTimes(1);
  });

  it("reapresentar uma citação antiga que não está mais na nota não vira evidência, nem vazia", async () => {
    const { repo, id } = await comSintese();
    await repo.atualizarNota("1", { conteudo: `O limite de itens por pedido é 20. ${PRAZO}.` }, { revisaoBase: 1, autor });
    vi.advanceTimersByTime(ESPERA);
    await rodar(repo, com(proposta({ alvoId: id, afirmacoes: [
      afirmacao("Limite de 10 itens (de novo)", "1", LIMITE_10), afirmacao("Limite de 20 itens", "1", "O limite de itens por pedido é 20")] })));
    const conteudo = (await repo.obterNota("1"))!.conteudo;
    const afirmacoes = (await repo.wiki!.obter(id))!.afirmacoes;
    expect(afirmacoes.map((a) => a.texto)).toEqual(expect.arrayContaining(["Limite de 20 itens", "Prazo de 5 dias"]));
    expect(afirmacoes.map((a) => a.texto)).not.toContain("Limite de 10 itens (de novo)");
    for (const a of afirmacoes) for (const e of a.evidencias) {
      expect(e.citacao).not.toBe("");
      expect(conteudo.slice(e.inicio, e.fim)).toBe(e.citacao);
    }
  });

  it("uma afirmação desatualizada pode ser retirada sozinha, sem nada no lugar", async () => {
    const { repo, id, limite10 } = await origemEditada();
    const r = await rodar(repo, com(proposta({ alvoId: id, retiradas: [limite10.id] })));
    expect(r).toMatchObject({ publicadas: 1, descartadas: 0 });
    expect(await textos(repo, id)).toEqual(["Prazo de 5 dias"]);
  });

  it("uma afirmação desatualizada pode ser substituída por outra que a origem nova sustenta", async () => {
    const { repo, id, limite10 } = await origemEditada();
    await rodar(repo, com(proposta({ alvoId: id, substituicoes: [{ id: limite10.id,
      afirmacao: afirmacao("O limite é 10 até março e 20 depois", "1", `${LIMITE_10} até março, depois 20`) }] })));
    expect(await textos(repo, id)).toEqual(["Prazo de 5 dias", "O limite é 10 até março e 20 depois"]);
  });

  it("reapresentar uma inferência como explícita não a promove a fato", async () => {
    const repo = criarRepositorioEmMemoria([{ titulo: "Limites", conteudo: `${LIMITE_10}. ${PRAZO}.` }]);
    vi.advanceTimersByTime(ESPERA);
    await rodar(repo, async (c) => ({ proposta: { propostas: [proposta({ afirmacoes: [
      { ...afirmacao("Limite de 10 itens", c.origem.id, LIMITE_10), natureza: "inferencia" as const }] })] }, uso: null }));
    const [pagina] = await repo.wiki!.listar();
    const origem = await novaNota(repo);
    await rodar(repo, com(proposta({ alvoId: pagina.notaId, afirmacoes: [
      afirmacao("Limite de 10 itens", "1", LIMITE_10), afirmacao("Limite de 20 itens a partir de março", origem, LIMITE_20)] })));
    const depois = (await repo.wiki!.obter(pagina.notaId))!.afirmacoes;
    expect(depois.find((a) => a.texto === "Limite de 10 itens")?.natureza).toBe("inferencia");
    expect((await repo.obterNota(pagina.notaId))!.conteudo).toContain("**Inferência:** Limite de 10 itens");
    expect(depois).toHaveLength(2);
  });

  it("trocar só a evidência de uma afirmação, com o mesmo texto, é uma mudança e não 'sem mudança'", async () => {
    const { repo, id, limite10, prazo } = await comSintese();
    await reler(repo);
    // A última afirmação troca de evidência: a ordem e o texto não mudam, então o markdown sai idêntico ao anterior.
    const antes = (await repo.obterNota(id))!.conteudo;
    const r = await rodar(repo, com(proposta({ alvoId: id, substituicoes: [{ id: prazo.id,
      afirmacao: afirmacao("Prazo de 5 dias", "1", LIMITE_10) }] })));
    expect(r).toMatchObject({ publicadas: 1, descartadas: 0 });
    expect((await repo.obterNota(id))!.conteudo).toBe(antes.replace(/\*\*Inferência:\*\* /g, ""));
    const trocada = (await repo.wiki!.obter(id))!.afirmacoes.find((a) => a.texto === "Prazo de 5 dias")!;
    expect(trocada.evidencias[0].citacao).toBe(LIMITE_10);
    expect(trocada.id).not.toBe(prazo.id);
    expect((await repo.wiki!.obter(id))!.afirmacoes.find((a) => a.texto === "Limite de 10 itens")?.id).toBe(limite10.id);
  });
});
