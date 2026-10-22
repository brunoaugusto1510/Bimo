import { describe, expect, it, vi } from "vitest";
import { criarRepositorioEmMemoria } from "../repositorio-de-notas/memoria";
import { compilarWiki, obterIndiceWiki } from "./servico";
import { executarFerramenta } from "../ferramentas";

const preparar = () => criarRepositorioEmMemoria([
  { titulo: "Cache", conteudo: "O cache mantém cópias dos dados." },
  { titulo: "Offline", conteudo: "A sincronização precisa tratar alterações concorrentes." },
]);
const proposta = { afirmacoes: [{ texto: "Cópias exigem atenção à sincronização.", natureza: "inferencia", evidencias: [
  { fonteId: "1", citacao: "cópias dos dados" }, { fonteId: "2", citacao: "alterações concorrentes" },
] }], lacunas: ["Não há uma política de resolução registrada."] };
const entrada = { titulo: "Consistência", fontes: ["1", "2"] };

describe("Wiki Viva sob pedido", () => {
  it("publica uma nota pesquisável com evidências exatas, sem alterar originais", async () => {
    const repo = preparar();
    const antes = await repo.listarComConteudo();
    const gerar = vi.fn().mockResolvedValue(proposta);
    const resultado = await compilarWiki(repo, entrada, gerar);
    expect(resultado.tipo).toBe("ok");
    expect(await repo.obterNota("1")).toEqual(antes[0]);
    expect(await repo.obterNota("2")).toEqual(antes[1]);
    const [pagina] = await obterIndiceWiki(repo);
    expect(pagina).toMatchObject({ titulo: "Consistência", estado: "atualizada", fontes: 2 });
    const nota = await repo.obterNota(pagina.id);
    expect(nota?.conteudo).toContain("Inferência");
    expect(nota?.conteudo).toContain("[[Cache]]");
    expect(await repo.buscarPorConteudo("sincronização", 10)).toEqual(expect.arrayContaining([expect.objectContaining({ id: pagina.id })]));
    const meta = await repo.wiki!.obter(pagina.id);
    expect(meta?.fontes[0].conteudo).toBe(antes[0].conteudo);
    expect(meta?.afirmacoes[0].evidencias[0]).toMatchObject({ fonteId: "1", inicio: 15, fim: 31 });
  });

  it.each([
    { ...proposta, afirmacoes: [{ ...proposta.afirmacoes[0], evidencias: [{ fonteId: "99", citacao: "x" }] }] },
    { ...proposta, afirmacoes: [{ ...proposta.afirmacoes[0], evidencias: [{ fonteId: "1", citacao: "não existe" }] }] },
    { ...proposta, afirmacoes: [{ ...proposta.afirmacoes[0], evidencias: [] }] },
    { ...proposta, afirmacoes: [] },
  ])("recusa proposta sem sustentação verificável", async (dados) => {
    const repo = preparar();
    await expect(compilarWiki(repo, entrada, vi.fn().mockResolvedValue(dados))).rejects.toThrow();
    expect(await repo.listarResumos()).toHaveLength(2);
  });

  it("recusa nota ausente, derivada ou corpo grande antes do provedor", async () => {
    const repo = preparar(); const gerar = vi.fn();
    await expect(compilarWiki(repo, { ...entrada, fontes: ["99"] }, gerar)).rejects.toThrow();
    await repo.atualizarNota("1", { conteudo: "x".repeat(60_001) }, { revisaoBase: 1, autor: { criadoPor: "usuario" } });
    await expect(compilarWiki(repo, entrada, gerar)).rejects.toThrow(/limite/i);
    expect(gerar).not.toHaveBeenCalled();
  });

  it("revalida fontes na publicação após edição concorrente", async () => {
    const repo = preparar();
    await expect(compilarWiki(repo, entrada, async () => {
      await repo.atualizarNota("1", { conteudo: "mudou" }, { revisaoBase: 1, autor: { criadoPor: "usuario" } });
      return proposta;
    })).rejects.toThrow(/mudou|alterada/i);
    expect(await repo.listarResumos()).toHaveLength(2);
  });

  it("enriquece a mesma página, inclui fontes anteriores e evita chamada sem mudanças", async () => {
    const repo = preparar(); await compilarWiki(repo, entrada, async () => proposta);
    const [pagina] = await obterIndiceWiki(repo);
    const gerar = vi.fn().mockResolvedValue(proposta);
    expect((await compilarWiki(repo, { ...entrada, paginaId: pagina.id, revisaoBase: pagina.revisao }, gerar)).tipo).toBe("sem_mudanca");
    expect(gerar).not.toHaveBeenCalled();
    await repo.atualizarNota("2", { conteudo: "A sincronização precisa tratar alterações concorrentes. Nova informação." }, { revisaoBase: 1, autor: { criadoPor: "usuario" } });
    expect((await obterIndiceWiki(repo))[0].estado).toBe("desatualizada");
    await compilarWiki(repo, { titulo: entrada.titulo, fontes: ["2"], paginaId: pagina.id, revisaoBase: pagina.revisao }, gerar);
    expect(await repo.listarResumos()).toHaveLength(3);
    expect((await repo.wiki!.obter(pagina.id))?.fontes.map((f) => f.id)).toEqual(["1", "2"]);
    expect((await obterIndiceWiki(repo))[0].estado).toBe("atualizada");
  });

  it("protege edição manual e rejeita uma nota pessoal como alvo", async () => {
    const repo = preparar(); const gerar = vi.fn();
    await expect(compilarWiki(repo, { ...entrada, paginaId: "1", revisaoBase: 1 }, gerar)).rejects.toThrow();
    await compilarWiki(repo, entrada, async () => proposta);
    const [pagina] = await obterIndiceWiki(repo);
    await repo.atualizarNota(pagina.id, { conteudo: "correção pessoal" }, { revisaoBase: pagina.revisao, autor: { criadoPor: "usuario" } });
    await expect(compilarWiki(repo, { ...entrada, paginaId: pagina.id, revisaoBase: pagina.revisao }, gerar)).rejects.toThrow();
    expect((await obterIndiceWiki(repo))[0].estado).toBe("edicao_manual");
    expect(gerar).not.toHaveBeenCalled();
  });

  it("isola o índice por repositório e devolve cópias dos snapshots", async () => {
    const repo = preparar(); await compilarWiki(repo, entrada, async () => proposta);
    expect(await obterIndiceWiki(preparar())).toEqual([]);
    const [pagina] = await obterIndiceWiki(repo);
    const meta = (await repo.wiki!.obter(pagina.id))!;
    meta.fontes[0].conteudo = "intruso";
    expect((await repo.wiki!.obter(pagina.id))?.fontes[0].conteudo).not.toBe("intruso");
    await expect(compilarWiki(repo, { titulo: "Outra síntese", fontes: [pagina.id] }, vi.fn())).rejects.toThrow(/derivada/i);
  });

  it("não duplica página em pedidos concorrentes nem sobrescreve colisão pessoal", async () => {
    const repo = preparar();
    const resultados = await Promise.allSettled([compilarWiki(repo, entrada, async () => proposta), compilarWiki(repo, entrada, async () => proposta)]);
    expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await repo.wiki!.listar()).toHaveLength(1);
  });

  it("o agente distingue uma síntese de evidência original e avisa quando está desatualizada", async () => {
    const repo = preparar(); await compilarWiki(repo, entrada, async () => proposta);
    let leitura = await executarFerramenta("ler_nota", { caminho: "Wiki/Consistência" }, { repositorio: repo });
    expect(leitura.resposta.avisoWiki).toMatch(/derivada/);
    await repo.atualizarNota("1", { conteudo: "mudou" }, { revisaoBase: 1, autor: { criadoPor: "usuario" } });
    leitura = await executarFerramenta("ler_nota", { caminho: "Wiki/Consistência" }, { repositorio: repo });
    expect(leitura.resposta.avisoWiki).toMatch(/mudaram/);
  });

  it("bloqueia publicação caso o usuário edite a página durante a chamada", async () => {
    const repo = preparar(); await compilarWiki(repo, entrada, async () => proposta);
    const [p] = await obterIndiceWiki(repo);
    await repo.atualizarNota("1", { conteudo: "O cache mantém cópias dos dados. Mais." }, { revisaoBase: 1, autor: { criadoPor: "usuario" } });
    await expect(compilarWiki(repo, { ...entrada, paginaId: p.id, revisaoBase: p.revisao }, async () => {
      await repo.atualizarNota(p.id, { conteudo: "meu texto" }, { revisaoBase: p.revisao, autor: { criadoPor: "usuario" } });
      return proposta;
    })).rejects.toThrow(/alterada/);
    expect((await repo.obterNota(p.id))?.conteudo).toBe("meu texto");
  });

  it("preserva caracteres Unicode e CRLF nas referências e escapa links produzidos pelo modelo", async () => {
    const repo = criarRepositorioEmMemoria([{ titulo: "Experiência", conteudo: "😀 início\r\nInformação útil." }]);
    const resultado = await compilarWiki(repo, { titulo: "Síntese", fontes: ["1"] }, async () => ({
      afirmacoes: [{ texto: "[[Página inventada]] <script>", natureza: "inferencia", evidencias: [{ fonteId: "1", citacao: "Informação útil" }] }], lacunas: [],
    }));
    expect(resultado.tipo).toBe("ok");
    const [meta] = await repo.wiki!.listar(); const evidencia = meta.afirmacoes[0].evidencias[0];
    expect(meta.fontes[0].conteudo.slice(evidencia.inicio, evidencia.fim)).toBe("Informação útil");
    expect((await repo.obterNota(meta.notaId))?.conteudo).not.toContain("[[Página inventada]]");
  });

  it("recusa título inválido, contexto vazio e exceder dez fontes antes de gerar", async () => {
    const repo = preparar(); const gerar = vi.fn();
    await expect(compilarWiki(repo, { ...entrada, titulo: "A/B" }, gerar)).rejects.toThrow();
    await repo.atualizarNota("1", { conteudo: " " }, { revisaoBase: 1, autor: { criadoPor: "usuario" } });
    await expect(compilarWiki(repo, entrada, gerar)).rejects.toThrow(/conteúdo/);
    await expect(compilarWiki(repo, { ...entrada, fontes: Array.from({ length: 11 }, (_, i) => String(i)) }, gerar)).rejects.toThrow();
    expect(gerar).not.toHaveBeenCalled();
  });

  it("não sobrescreve uma nota pessoal que ocupa o título de destino", async () => {
    const repo = preparar();
    await repo.criarNota({ titulo: "Consistência", pasta: "Wiki", conteudo: "anotação pessoal" }, { criadoPor: "usuario" });
    const gerar = vi.fn().mockResolvedValue(proposta);
    await expect(compilarWiki(repo, entrada, gerar)).rejects.toThrow(/título/);
    expect(gerar).not.toHaveBeenCalled();
    expect((await repo.listarComConteudo()).find((n) => n.titulo === "Consistência")?.conteudo).toBe("anotação pessoal");
    expect(await repo.wiki!.listar()).toEqual([]);
  });
});
