import { describe, expect, it, vi } from "vitest";
import { importarNotas, interpretarArgumentos, formatarRelatorio, type FonteDeImportacao } from "./importacao-de-notas";
import { criarRepositorioEmMemoria } from "./repositorio-de-notas/memoria";

function fonteFalsa(textos: Record<string, string | null>, aviso?: string): FonteDeImportacao {
  return {
    obterNotasPlanas: async () => ({ notas: Object.keys(textos).map(caminho => ({ caminho })), aviso }),
    lerConteudoDaNota: async caminho => {
      if (textos[caminho] === null) throw new Error("download indisponível");
      return textos[caminho];
    },
  };
}

const executar = { executar: true, sobrescrever: false };

describe("importação de notas", () => {
  it("cria com conteúdo exato, tags e autoria; segunda rodada é idempotente", async () => {
    const repositorio = criarRepositorioEmMemoria();
    const criar = vi.spyOn(repositorio, "criarNota");
    const conteudo = "---\r\ntags: [estudo]\r\n---\r\n#corpo\r\n";
    const fonte = fonteFalsa({ "Pasta/Nota.md": conteudo });
    expect((await importarNotas({ fonte, repositorio, opcoes: executar })).contagens.criadas).toBe(1);
    expect(criar).toHaveBeenCalledWith({ titulo: "Nota", pasta: "Pasta", conteudo, tags: ["estudo", "corpo"] }, { criadoPor: "usuario", ferramenta: "importar-notas" });
    expect((await repositorio.listarComConteudo())[0].conteudo).toBe(conteudo);
    expect((await importarNotas({ fonte, repositorio, opcoes: executar })).contagens.jaImportadas).toBe(1);
    expect(await repositorio.listarResumos()).toHaveLength(1);
  });

  it("preserva divergência e sobrescreve somente com revisão atual e checkpoint", async () => {
    const repositorio = criarRepositorioEmMemoria([{ titulo: "Nota", conteudo: "antigo" }]);
    const fonte = fonteFalsa({ "Nota.md": "novo" });
    const atualizar = vi.spyOn(repositorio, "atualizarNota");
    expect((await importarNotas({ fonte, repositorio, opcoes: executar })).contagens.divergentes).toBe(1);
    expect(atualizar).not.toHaveBeenCalled();
    const atual = (await repositorio.listarComConteudo())[0];
    expect((await importarNotas({ fonte, repositorio, opcoes: { ...executar, sobrescrever: true } })).contagens.sobrescritas).toBe(1);
    expect(atualizar).toHaveBeenCalledWith(atual.id, { conteudo: "novo", tags: [] }, { revisaoBase: atual.revisao, checkpoint: true, autor: { criadoPor: "usuario", ferramenta: "importar-notas" } });
  });

  it("ignora título inválido e pasta com caracteres de controle", async () => {
    const relatorio = await importarNotas({ fonte: fonteFalsa({ "Invalida#.md": "x", "Ruim\u0001/Nota.md": "x" }), repositorio: criarRepositorioEmMemoria(), opcoes: executar });
    expect(relatorio.contagens.ignoradas).toBe(2);
    expect(relatorio.codigoDeSaida).toBe(0);
  });

  it("isola falha de download, inclusive ausência de conteúdo", async () => {
    const fonte = fonteFalsa({ "Falha.md": null, "Boa.md": "texto" });
    const repositorio = criarRepositorioEmMemoria();
    const relatorio = await importarNotas({ fonte, repositorio, opcoes: executar });
    expect(relatorio.contagens).toMatchObject({ falhas: 1, criadas: 1 });
    expect(relatorio.codigoDeSaida).toBe(1);
  });

  it.each([true, false])("detecta colisão de maiúsculas e informa ambos os caminhos (executar=%s)", async executar => {
    const relatorio = await importarNotas({ fonte: fonteFalsa({ "Nota.md": "a", "nota.md": "b" }), repositorio: criarRepositorioEmMemoria(), opcoes: { executar, sobrescrever: false } });
    expect(relatorio.contagens.colisoes).toBe(1);
    expect(relatorio.itens.find(item => item.situacao === "colisoes")).toMatchObject({ caminho: "nota.md", caminhoExistente: "Nota.md" });
    expect(relatorio.codigoDeSaida).toBe(1);
  });

  it("simula criação e sobrescrita sem chamar escritas", async () => {
    const repositorio = criarRepositorioEmMemoria([{ titulo: "Nota", conteudo: "antigo" }]);
    const criar = vi.spyOn(repositorio, "criarNota");
    const atualizar = vi.spyOn(repositorio, "atualizarNota");
    const relatorio = await importarNotas({ fonte: fonteFalsa({ "Nova.md": "a", "Nota.md": "novo" }), repositorio, opcoes: { executar: false, sobrescrever: true } });
    expect(relatorio.contagens).toMatchObject({ criadas: 1, sobrescritas: 1 });
    expect(criar).not.toHaveBeenCalled();
    expect(atualizar).not.toHaveBeenCalled();
    const saida = formatarRelatorio(relatorio);
    expect(saida.startsWith("SIMULAÇÃO — nada foi gravado. Use --executar para gravar.")).toBe(true);
    expect(saida.endsWith("SIMULAÇÃO — nada foi gravado. Use --executar para gravar.")).toBe(true);
  });

  it("filtra subpasta por segmento antes do limite", async () => {
    const repositorio = criarRepositorioEmMemoria();
    await importarNotas({ fonte: fonteFalsa({ "AB/Fora.md": "x", "A/Um.md": "a", "A/Sub/Dois.md": "b" }), repositorio, opcoes: { ...executar, pasta: "A", limite: 1 } });
    expect((await repositorio.listarResumos()).map(nota => nota.titulo)).toEqual(["Um"]);
  });

  it("recusa listagem truncada antes de escrever, aceita pasta explícita ou simulação", async () => {
    const fonte = fonteFalsa({ "A/Nota.md": "x" }, "Listagem incompleta.");
    const repositorio = criarRepositorioEmMemoria();
    await expect(importarNotas({ fonte, repositorio, opcoes: executar })).rejects.toThrow("--pasta");
    expect(await repositorio.listarResumos()).toHaveLength(0);
    expect((await importarNotas({ fonte, repositorio, opcoes: { ...executar, executar: false } })).aviso).toContain("incompleta");
    expect((await importarNotas({ fonte, repositorio, opcoes: { ...executar, pasta: "A" } })).contagens.criadas).toBe(1);
  });

  it("relata conflito de revisão sem sobrescrever alterações concorrentes", async () => {
    const repositorio = criarRepositorioEmMemoria([{ titulo: "Nota", conteudo: "antigo" }]);
    const atual = (await repositorio.listarComConteudo())[0];
    vi.spyOn(repositorio, "atualizarNota").mockResolvedValue({ tipo: "conflito", atual });
    const relatorio = await importarNotas({ fonte: fonteFalsa({ "Nota.md": "novo" }), repositorio, opcoes: { ...executar, sobrescrever: true } });
    expect(relatorio.contagens.falhas).toBe(1);
    expect(relatorio.itens[0].motivo).toContain("revisão");
  });
});

describe("argumentos", () => {
  it("simula por padrão e interpreta todas as flags", () => {
    expect(interpretarArgumentos([])).toEqual({ executar: false, sobrescrever: false });
    expect(interpretarArgumentos(["--executar", "--sobrescrever", "--pasta", "/A/B/", "--limite", "3"])).toEqual({ executar: true, sobrescrever: true, pasta: "A/B", limite: 3 });
  });
  it.each([["--outra"], ["--pasta"], ["--pasta", "--executar"], ["--pasta", "/"], ["--limite", "0"], ["--limite", "-1"], ["--limite", "1.5"], ["--limite", "Infinity"]])("recusa argumentos inválidos: %s", (...args) => {
    expect(() => interpretarArgumentos(args)).toThrow(/--executar.*--pasta.*--limite.*--sobrescrever/);
  });
});

describe("limites e falhas operacionais", () => {
  it("limita downloads a oito e mantém escritas sequenciais", async () => {
    let ativos = 0;
    let maximo = 0;
    const fonte: FonteDeImportacao = {
      obterNotasPlanas: async () => ({ notas: Array.from({ length: 20 }, (_, i) => ({ caminho: `Nota ${i}.md` })) }),
      lerConteudoDaNota: async () => {
        ativos++;
        maximo = Math.max(maximo, ativos);
        await new Promise(resolve => setTimeout(resolve, 1));
        ativos--;
        return "texto";
      },
    };
    const repositorio = criarRepositorioEmMemoria();
    const criar = repositorio.criarNota.bind(repositorio);
    let escritas = 0;
    let maximoEscritas = 0;
    vi.spyOn(repositorio, "criarNota").mockImplementation(async (...args) => {
      escritas++;
      maximoEscritas = Math.max(maximoEscritas, escritas);
      await new Promise(resolve => setTimeout(resolve, 1));
      const resultado = await criar(...args);
      escritas--;
      return resultado;
    });
    expect((await importarNotas({ fonte, repositorio, opcoes: executar })).contagens.criadas).toBe(20);
    expect(maximo).toBe(8);
    expect(maximoEscritas).toBe(1);
  });

  it("trata título-em-uso devolvido pelo índice com o caminho existente", async () => {
    const repositorio = criarRepositorioEmMemoria([{ titulo: "Existente" }]);
    const existente = (await repositorio.listarResumos())[0];
    vi.spyOn(repositorio, "criarNota").mockResolvedValue({ tipo: "titulo-em-uso", idExistente: existente.id });
    const relatorio = await importarNotas({ fonte: fonteFalsa({ "Outra.md": "x" }), repositorio, opcoes: executar });
    expect(relatorio.itens[0]).toMatchObject({ caminho: "Outra.md", caminhoExistente: "Existente.md", situacao: "colisoes" });
  });

  it("ausência de conteúdo conta como falha de download", async () => {
    const fonte = fonteFalsa({ "Nota.md": "x" });
    fonte.lerConteudoDaNota = async () => null;
    expect((await importarNotas({ fonte, repositorio: criarRepositorioEmMemoria(), opcoes: executar })).contagens.falhas).toBe(1);
  });

  it("isola erro de gravação sem expor detalhes do driver", async () => {
    const repositorio = criarRepositorioEmMemoria();
    vi.spyOn(repositorio, "criarNota").mockRejectedValueOnce(new Error("detalhe privado"));
    const relatorio = await importarNotas({ fonte: fonteFalsa({ "Falha.md": "x", "Boa.md": "y" }), repositorio, opcoes: executar });
    expect(relatorio.contagens).toMatchObject({ falhas: 1, criadas: 1 });
    expect(formatarRelatorio(relatorio)).not.toContain("detalhe privado");
  });
});
