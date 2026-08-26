import { servicoVaultFake, redefinirVaultFake } from "./servicoVaultFake";
import { servicoIaFake } from "./servicoIaFake";

beforeEach(() => {
  redefinirVaultFake();
});

describe("servicoVaultFake", () => {
  it("lista as notas do fixture", async () => {
    const notas = await servicoVaultFake.listarNotas();
    expect(notas.length).toBeGreaterThanOrEqual(12);
    expect(notas[0]).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        titulo: expect.any(String),
        pasta: expect.any(String),
        conexoes: expect.any(Number),
      }),
    );
  });

  it("obtém uma nota pelo id", async () => {
    const notas = await servicoVaultFake.listarNotas();
    const nota = await servicoVaultFake.obterNota(notas[0].id);
    expect(nota.id).toBe(notas[0].id);
  });

  it("recusa um id inexistente", async () => {
    await expect(servicoVaultFake.obterNota("nao-existe")).rejects.toThrow("Nota não encontrada");
  });

  it("só produz arestas entre ids que existem", async () => {
    const notas = await servicoVaultFake.listarNotas();
    const ids = new Set(notas.map((nota) => nota.id));
    const arestas = await servicoVaultFake.listarArestas();
    expect(arestas.length).toBeGreaterThan(0);
    for (const aresta of arestas) {
      expect(ids.has(aresta.de)).toBe(true);
      expect(ids.has(aresta.para)).toBe(true);
    }
  });

  it("salva uma nota e devolve o conteúdo novo na leitura seguinte", async () => {
    const notas = await servicoVaultFake.listarNotas();
    await servicoVaultFake.salvarNota({ ...notas[0], titulo: "Título trocado" });
    const nota = await servicoVaultFake.obterNota(notas[0].id);
    expect(nota.titulo).toBe("Título trocado");
  });
});

describe("servicoIaFake", () => {
  it("responde com texto e cartões que apontam para notas reais", async () => {
    const notas = await servicoVaultFake.listarNotas();
    const ids = new Set(notas.map((nota) => nota.id));
    const resposta = await servicoIaFake.conversar("o que eu escrevi sobre notas atômicas?");
    expect(resposta.texto.length).toBeGreaterThan(0);
    for (const id of resposta.cartoes) {
      expect(ids.has(id)).toBe(true);
    }
  });

  it("devolve uma sugestão para cada uma das cinco ações", async () => {
    const [nota] = await servicoVaultFake.listarNotas();
    const tipos = ["links", "resumo", "tags", "continuar", "perguntar"] as const;
    for (const tipo of tipos) {
      const sugestao = await servicoIaFake.acaoNaNota(tipo, nota);
      expect(sugestao.tipo).toBe(tipo);
      expect(sugestao.rotulo.length).toBeGreaterThan(0);
      expect(sugestao.texto.length).toBeGreaterThan(0);
    }
  });

  it("devolve tags na ação de tags", async () => {
    const [nota] = await servicoVaultFake.listarNotas();
    const sugestao = await servicoIaFake.acaoNaNota("tags", nota);
    expect(sugestao.tags?.every((tag) => tag.startsWith("#") && tag === tag.toLowerCase())).toBe(true);
  });

  it("a sugestão de links nunca cita a própria nota", async () => {
    const notas = await servicoVaultFake.listarNotas();
    // amostra: a primeira nota e as duas que o bug antigo fixava por índice
    const amostra = [notas[0], notas[1], notas[2]];
    for (const nota of amostra) {
      const sugestao = await servicoIaFake.acaoNaNota("links", nota);
      expect(sugestao.texto.includes(`'${nota.titulo}'`)).toBe(false);
      expect(sugestao.texto.includes(`[[${nota.titulo}]]`)).toBe(false);
    }
  });
});
