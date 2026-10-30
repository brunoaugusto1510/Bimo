// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { executarFerramenta } from "./ferramentas";
import { criarRepositorioEmMemoria } from "./repositorio-de-notas/memoria";
import type { RepositorioDeNotas } from "./repositorio-de-notas/tipos";
import { processarWiki } from "./wiki/automacao";
import { ESTABILIDADE_DA_WIKI_SEGUNDOS } from "./wiki/configuracao";

const buscar = (repositorio: RepositorioDeNotas, consulta: string, extras: Record<string, unknown> = {}) =>
  executarFerramenta("buscar_notas", { consulta, ...extras }, { repositorio });
const notas = () => criarRepositorioEmMemoria([
  { titulo: "Blockchain", conteudo: "Registro distribuído de transações." },
  { titulo: "Token e digitalização", conteudo: "Tokenização representa um ativo digitalmente." },
]);
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

describe("busca do chat por assuntos", () => {
  it("recupera os dois assuntos do print quando a consulta conjunta não encontra nada", async () => {
    const saida = await buscar(notas(), "blockchain tokenização tokens");
    expect(saida.erro).toBeUndefined();
    expect(saida.resposta).toMatchObject({ encontradas: 2, ampliada: true,
      notas: [{ titulo: "Blockchain" }, { titulo: "Token e digitalização" }],
      buscas: [
        { consulta: "blockchain tokenização tokens", encontradas: 0 },
        { consulta: "blockchain", encontradas: 1 },
        { consulta: "tokenização", encontradas: 1 },
        { consulta: "tokens", encontradas: 0 },
      ],
    });
    expect(saida.resumo).toContain("ampliada");
    expect(saida.resposta.avisoDaBusca).toMatch(/não.*todos os termos/);
  });

  it("preserva a busca específica quando ela já tem resultados", async () => {
    const repo = criarRepositorioEmMemoria([
      { titulo: "Handshake TCP", conteudo: "Abertura da conexão." },
      { titulo: "TCP", conteudo: "Transporte." },
    ]);
    const pesquisar = vi.spyOn(repo, "buscarPorConteudo");
    const saida = await buscar(repo, "handshake TCP");
    expect(saida.resposta).toMatchObject({ encontradas: 1, notas: [{ titulo: "Handshake TCP" }] });
    expect(pesquisar).toHaveBeenCalledTimes(1);
    expect(saida.resposta.ampliada).not.toBe(true);
  });

  it("combina consultas explícitas com a original, sem duplicar e sem perder seu ranking", async () => {
    const repo = notas();
    await repo.criarNota({ titulo: "Blockchain e tokenização", conteudo: "Conexão entre assuntos." }, { criadoPor: "usuario" });
    const saida = await buscar(repo, "blockchain tokenização", { consultas: ["blockchain", "token"] });
    expect(saida.resposta).toMatchObject({ encontradas: 3, ampliada: true,
      notas: [{ titulo: "Blockchain e tokenização" }, { titulo: "Blockchain" }, { titulo: "Token e digitalização" }],
    });
    expect(saida.ids).toHaveLength(3);
    expect(new Set(saida.ids).size).toBe(3);
  });

  it("distribui o limite entre os assuntos em vez de preencher tudo com o primeiro", async () => {
    const repo = criarRepositorioEmMemoria([
      ...Array.from({ length: 10 }, (_, i) => ({ titulo: `Blockchain ${i}`, conteudo: "Consenso." })),
      { titulo: "Tokenização", conteudo: "Representação de ativos." },
    ]);
    const saida = await buscar(repo, "blockchain tokenização", { consultas: ["blockchain", "tokenização"], limite: 2 });
    expect(saida.resposta.notas).toEqual([
      expect.objectContaining({ titulo: "Blockchain 0" }), expect.objectContaining({ titulo: "Tokenização" }),
    ]);
    expect(saida.ids).toHaveLength(2);
  });

  it.each(['"blockchain tokenização"', "blockchain OR tokenização", "blockchain -tokenização", "C++ redes"])(
    "não desfaz a intenção de uma consulta com sintaxe explícita: %s", async (consulta) => {
      const repo = notas();
      const pesquisar = vi.spyOn(repo, "buscarPorConteudo");
      await buscar(repo, consulta);
      expect(pesquisar).toHaveBeenCalledTimes(1);
      expect(pesquisar).toHaveBeenCalledWith(consulta, 8);
    },
  );

  it("limita a quatro ampliações e ignora palavras comuns e repetidas", async () => {
    const repo = notas();
    const pesquisar = vi.spyOn(repo, "buscarPorConteudo");
    await buscar(repo, "com blockchain BLOCKCHAIN tokenização tokens consenso registro finanças");
    expect(pesquisar.mock.calls.map(([consulta]) => consulta)).toEqual([
      "com blockchain BLOCKCHAIN tokenização tokens consenso registro finanças", "blockchain", "tokenização", "tokens", "consenso",
    ]);
  });

  it("deduplica consultas explícitas por caixa e acentos", async () => {
    const repo = notas();
    const pesquisar = vi.spyOn(repo, "buscarPorConteudo");
    await buscar(repo, "blockchain tokenização", { consultas: ["tokenização", "TOKENIZACAO", " blockchain "] });
    expect(pesquisar.mock.calls.map(([consulta]) => consulta)).toEqual(["blockchain tokenização", "tokenização", "blockchain"]);
  });

  it.each(["blockchain", [123], [""], ["x".repeat(161)], Array(5).fill("token")])(
    "recusa consultas adicionais inválidas antes de consultar o repositório: %j", async (consultas) => {
      const repo = notas();
      const pesquisar = vi.spyOn(repo, "buscarPorConteudo");
      const saida = await buscar(repo, "blockchain", { consultas });
      expect(saida.erro).toBe(true);
      expect(pesquisar).not.toHaveBeenCalled();
    },
  );

  it("funciona sem capacidade de Wiki", async () => {
    const saida = await buscar({ ...notas(), wiki: undefined }, "blockchain tokenização");
    expect(saida.erro).toBeUndefined();
    expect(saida.resposta.encontradas).toBe(2);
  });

  it("mantém as notas acessíveis se o índice da Wiki falhar", async () => {
    const repo = notas();
    vi.spyOn(repo.wiki!, "listar").mockRejectedValue(new Error("falha privada"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const saida = await buscar(repo, "blockchain tokenização");
    expect(saida.erro).toBeUndefined();
    expect(saida.resposta.encontradas).toBe(2);
    expect(JSON.stringify(saida)).not.toContain("falha privada");
  });

  it("entrega o índice mesmo com zero notas e permite abrir o neurônio encontrado por alias", async () => {
    vi.useFakeTimers();
    const repo = criarRepositorioEmMemoria([{ titulo: "Experiência", conteudo: "Um ativo pode ser representado por uma unidade digital." }]);
    vi.advanceTimersByTime((ESTABILIDADE_DA_WIKI_SEGUNDOS + 1) * 1000);
    const resultado = await processarWiki(repo, async (c) => ({ proposta: { propostas: [{
      titulo: "Representação de ativos", alvoId: null, aliases: ["tokenização"], resumo: "Unidades digitais representam ativos.",
      afirmacoes: [{ texto: "Um ativo pode ser representado digitalmente.", natureza: "explicita", evidencias: [{ fonteId: c.origem.id, citacao: c.trecho.texto }] }], lacunas: [],
    }] }, uso: { entrada: 1, saida: 1 } }), { tetoDiario: 200_000 });
    expect(resultado).toMatchObject({ publicadas: 1 });
    const saida = await buscar(repo, "tokenização");
    expect(saida.resposta).toMatchObject({ encontradas: 0,
      indiceWiki: { total: 1, neuronios: [{ caminho: "Neurônios/Representação de ativos.md" }] },
    });
    expect(saida.resumo).toContain("1 neurônio(s)");
    const indice = await executarFerramenta("indice_da_wiki", { consulta: "tokenização" }, { repositorio: repo });
    expect(indice.resposta).toMatchObject({ total: 1 });
    const leitura = await executarFerramenta("ler_nota", { caminho: "Neurônios/Representação de ativos.md" }, { repositorio: repo });
    expect(leitura.resposta.conteudo).toContain("Um ativo pode ser representado digitalmente.");
    expect(leitura.resposta).toHaveProperty("evidenciasWiki");
  });
});
