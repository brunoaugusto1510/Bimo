import { afterEach, describe, expect, it, vi } from "vitest";
import { declaracoesDeFerramentas, executarFerramenta } from "../ferramentas";
import { criarRepositorioEmMemoria } from "../repositorio-de-notas/memoria";
import type { RepositorioDeNotas } from "../repositorio-de-notas/tipos";

const semear = () => criarRepositorioEmMemoria([
  { titulo: "Álgebra", pasta: "Estudos/Matemática", conteudo: "Vetores e matrizes\n\n" },
  { titulo: "TCP", pasta: "Estudos/Redes", conteudo: "Protocolo confiável" },
]);
const executar = (repositorio: RepositorioDeNotas, nome: string, args: Record<string, unknown>) =>
  executarFerramenta(nome, args, { repositorio });
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("ferramentas com repositório de notas", () => {
  it("busca e devolve caminho, título e trecho", async () => {
    const saida = await executar(semear(), "buscar_notas", { consulta: "matrizes" });
    expect(saida.resposta).toMatchObject({ encontradas: 1, notas: [{ caminho: "Estudos/Matemática/Álgebra.md", titulo: "Álgebra", trecho: expect.stringContaining("matrizes") }] });
  });
  it("preserva o destaque do banco e limita os resultados", async () => {
    const repo = semear();
    const buscarPorConteudo = vi.fn(async () => [{ id: "1", titulo: "TCP", pasta: null, trecho: "**TCP**" }]);
    const repositorio = { ...repo, buscarPorConteudo };
    for (const [limite, esperado] of [[undefined, 8], [999, 20], [-1, 1], ["3", 3]] as const) {
      const saida = await executar(repositorio, "buscar_notas", { consulta: "TCP", limite });
      expect(buscarPorConteudo).toHaveBeenLastCalledWith("TCP", esperado);
      expect(saida.resposta.notas).toMatchObject([{ trecho: "**TCP**" }]);
    }
  });
  it("lista com filtro sem acentos nem distinção de caixa", async () => {
    expect((await executar(semear(), "listar_notas", { pasta: "/ESTUDOS/matematica/" })).resposta)
      .toMatchObject({ total: 1, caminhos: ["Estudos/Matemática/Álgebra.md"] });
  });
  it("limita a listagem a 200 e avisa sobre o total", async () => {
    const repo = criarRepositorioEmMemoria(Array.from({ length: 201 }, (_, i) => ({ titulo: `Nota ${i}` })));
    const saida = await executar(repo, "listar_notas", {});
    expect(saida.resposta.total).toBe(201);
    expect(saida.resposta.caminhos).toHaveLength(200);
    expect(saida.resposta.aviso).toContain("201");
  });
  it.each(["algebra", "matematica/algebra", "/estudos/matematica/algebra.MD", "lgebr"])("lê por caminho aproximado %s", async (caminho) => {
    expect((await executar(semear(), "ler_nota", { caminho })).resposta)
      .toMatchObject({ caminho: "Estudos/Matemática/Álgebra.md", conteudo: "Vetores e matrizes\n\n" });
  });
  it("recusa título ambíguo com as opções", async () => {
    const repo = criarRepositorioEmMemoria([{ titulo: "TCP", pasta: "A" }, { titulo: "TCP", pasta: "B" }]);
    const saida = await executar(repo, "ler_nota", { caminho: "tcp" });
    expect(saida.erro).toBe(true);
    expect(saida.resumo).toMatch(/caminho completo/);
    expect(saida.resumo).toContain("A/TCP.md");
    expect(saida.resumo).toContain("B/TCP.md");
  });
  it("cria com autoria e devolve id sem commit", async () => {
    const repo = semear();
    const criarNota = vi.fn(repo.criarNota);
    const saida = await executar({ ...repo, criarNota }, "criar_nota", { caminho: "Estudos/DNS.md", conteudo: "# DNS" });
    expect(criarNota).toHaveBeenCalledWith({ pasta: "Estudos", titulo: "DNS", conteudo: "# DNS" }, { criadoPor: "agente", ferramenta: "criar_nota" });
    expect(saida.resposta).toEqual({ sucesso: true, caminho: "Estudos/DNS.md" });
    expect(await repo.obterNota(saida.notaId!)).toMatchObject({ titulo: "DNS" });
  });
  it("título em uso indica editar_nota e caminho existente", async () => {
    const saida = await executar(semear(), "criar_nota", { caminho: "Estudos/Redes/tcp.md", conteudo: "x" });
    expect(saida.erro).toBe(true);
    expect(saida.resumo).toMatch(/editar_nota.*Estudos\/Redes\/TCP.md/);
  });
  it("valida título com motivo antes de escrever", async () => {
    const repo = semear();
    const criarNota = vi.fn(repo.criarNota);
    const saida = await executar({ ...repo, criarNota }, "criar_nota", { caminho: "Ruim#.md", conteudo: "x" });
    expect(saida.erro).toBe(true);
    expect(saida.resumo).toMatch(/título não pode/);
    expect(criarNota).not.toHaveBeenCalled();
  });
  it.each(["criar_nota", "editar_nota"])("explica somente-leitura em %s", async (nome) => {
    const repo = semear();
    const repositorio: RepositorioDeNotas = { ...repo, criarNota: async () => ({ tipo: "somente-leitura" }), atualizarNota: async () => ({ tipo: "somente-leitura" }) };
    const saida = await executar(repositorio, nome, { caminho: "Estudos/Redes/TCP.md", conteudo: "x" });
    expect(saida.erro).toBe(true);
    expect(saida.resumo).toMatch(/modo leitura/);
  });
  it.each(["criar_nota", "editar_nota"])("repositório sem capacidade de escrita explica o modo leitura em %s", async (nome) => {
    const repo = semear();
    const repositorio: RepositorioDeNotas = {
      ...repo,
      capacidades: { escrita: false, datas: false },
      criarNota: async () => ({ tipo: "somente-leitura" }),
      atualizarNota: async () => ({ tipo: "somente-leitura" }),
    };
    const saida = await executar(repositorio, nome, { caminho: "Estudos/Redes/TCP.md", conteudo: "x" });
    expect(saida.erro).toBe(true);
    expect(saida.resumo).toMatch(/modo leitura/);
  });
  it.each(["acrescentar", "substituir", undefined, "invalido"])("edita no modo %s com checkpoint e revisão lida", async (modo) => {
    const repo = semear();
    const atualizarNota = vi.fn(repo.atualizarNota);
    const leituras = new Map<string, number>();
    await executarFerramenta("ler_nota", { caminho: "algebra" }, { repositorio: repo, leituras });
    const saida = await executarFerramenta("editar_nota", { caminho: "algebra", conteudo: "\n\nNovo", modo }, { repositorio: { ...repo, atualizarNota }, leituras });
    const esperado = modo === "substituir" ? "\n\nNovo" : "Vetores e matrizes\n\nNovo\n";
    expect(atualizarNota).toHaveBeenCalledWith(expect.any(String), { conteudo: esperado }, { revisaoBase: 1, autor: { criadoPor: "agente", ferramenta: "editar_nota" }, checkpoint: true });
    expect((await repo.obterNota(saida.notaId!))?.conteudo).toBe(esperado);
    expect(saida.resposta).not.toHaveProperty("commit");
  });
  it.each(["Texto\r\n\r\n", "Texto\n\n", ""])("acréscimo une as bordas sem duplicar quebras: %j", async (conteudo) => {
    const repo = criarRepositorioEmMemoria([{ titulo: "Nota", conteudo }]);
    const saida = await executar(repo, "editar_nota", { caminho: "Nota", conteudo: "\r\n\r\nNovo", modo: "acrescentar" });
    expect(saida.erro).toBeUndefined();
    expect((await repo.obterNota(saida.notaId!))?.conteudo).toBe(conteudo.includes("\r\n") ? "Texto\r\n\r\nNovo\r\n" : conteudo ? "Texto\n\nNovo\n" : "Novo\n");
  });
  it.each([false, true])("tenta só uma vez após conflito (persistente: %s)", async (persistente) => {
    const repo = semear();
    let chamadas = 0;
    const atualizarNota: RepositorioDeNotas["atualizarNota"] = vi.fn(async (id, mudancas, opcoes) => {
      chamadas++;
      if (chamadas === 1 || persistente) {
        await repo.atualizarNota(id, { conteudo: `Concorrente ${chamadas}\n` }, opcoes);
      }
      return repo.atualizarNota(id, mudancas, opcoes);
    });
    const saida = await executar({ ...repo, atualizarNota }, "editar_nota", { caminho: "TCP", conteudo: "Novo", modo: "acrescentar" });
    expect(chamadas).toBe(2);
    if (persistente) {
      expect(saida.erro).toBe(true);
      expect(saida.resumo).toMatch(/mudou durante a edição/);
    } else {
      expect(saida.erro).toBeUndefined();
      expect((await repo.obterNota(saida.notaId!))?.conteudo).toBe("Concorrente 1\n\nNovo\n");
    }
  });
  it("erro de configuração vira resultado normal", async () => {
    vi.stubEnv("NOTAS_FONTE", "inexistente");
    const saida = await executarFerramenta("listar_notas", {});
    expect(saida.erro).toBe(true);
    expect(saida.resumo).toContain("NOTAS_FONTE");
  });
  it.each(["ler_nota", "editar_nota"])("nota ausente em %s", async (nome) => {
    expect((await executar(semear(), nome, { caminho: "Ausente", conteudo: "x" })).erro).toBe(true);
  });
  it.each([["buscar_notas", {}], ["criar_nota", { caminho: "Nova" }]])("valida argumentos de %s", async (nome, args) => {
    expect((await executar(semear(), nome as string, args)).erro).toBe(true);
  });
  it("recusa ferramenta desconhecida", async () => {
    expect((await executar(semear(), "desconhecida", {})).resumo).toMatch(/desconhecida/);
  });
  it("declara os contratos sem armazenamento fixo", () => {
    expect(declaracoesDeFerramentas.map((d) => d.name)).toEqual(["buscar_notas", "listar_notas", "ler_nota", "criar_nota", "editar_nota"]);
    expect(JSON.stringify(declaracoesDeFerramentas)).not.toMatch(/vault|commit/i);
    expect(declaracoesDeFerramentas[0].description).toContain("título e no conteúdo");
    expect(declaracoesDeFerramentas[0].description).toContain("tags e no caminho");
    expect(JSON.stringify(declaracoesDeFerramentas)).not.toMatch(/github/i);
  });
});

describe("ids das notas tocadas (só para a interface)", () => {
  it("busca devolve os ids dos resultados na ordem do ranking, fora da resposta ao modelo", async () => {
    const repo = semear();
    const buscarPorConteudo = vi.fn(async () => [
      { id: "nota-b", titulo: "TCP", pasta: null, trecho: "t" },
      { id: "nota-a", titulo: "Álgebra", pasta: null, trecho: "a" },
    ]);
    const saida = await executar({ ...repo, buscarPorConteudo }, "buscar_notas", { consulta: "x" });
    expect(saida.ids).toEqual(["nota-b", "nota-a"]);
    expect(JSON.stringify(saida.resposta)).not.toContain("nota-b");
    expect(saida.resposta).not.toHaveProperty("ids");
  });
  it("busca sem resultados devolve lista vazia de ids", async () => {
    const saida = await executar(semear(), "buscar_notas", { consulta: "inexistente-xyz" });
    expect(saida.ids ?? []).toEqual([]);
  });
  it("leitura devolve o id da nota lida, fora da resposta ao modelo", async () => {
    const repo = semear();
    const saida = await executar(repo, "ler_nota", { caminho: "TCP" });
    const nota = (await repo.listarResumos()).find((n) => n.titulo === "TCP")!;
    expect(saida.ids).toEqual([nota.id]);
    expect(JSON.stringify(saida.resposta)).not.toContain(nota.id);
    expect(saida.resposta).not.toHaveProperty("ids");
  });
  it("criação e edição devolvem o id da nota gravada, fora da resposta ao modelo", async () => {
    const repo = semear();
    const criada = await executar(repo, "criar_nota", { caminho: "Estudos/DNS.md", conteudo: "# DNS" });
    expect(criada.ids).toEqual([criada.notaId]);
    expect(criada.resposta).not.toHaveProperty("ids");
    expect(JSON.stringify(criada.resposta)).not.toContain(criada.notaId!);

    const editada = await executar(repo, "editar_nota", { caminho: "Estudos/DNS.md", conteudo: "mais", modo: "acrescentar" });
    expect(editada.ids).toEqual([editada.notaId]);
    expect(editada.resposta).not.toHaveProperty("ids");
  });
  it("listagem e erros não devolvem ids", async () => {
    const repo = semear();
    expect((await executar(repo, "listar_notas", {})).ids).toBeUndefined();
    expect((await executar(repo, "ler_nota", { caminho: "Ausente" })).ids).toBeUndefined();
    expect((await executar(repo, "criar_nota", { caminho: "Estudos/Redes/tcp.md", conteudo: "x" })).ids).toBeUndefined();
    expect((await executar(repo, "buscar_notas", {})).ids).toBeUndefined();
    expect((await executar(repo, "ferramenta_que_nao_existe", {})).ids).toBeUndefined();
  });
});
