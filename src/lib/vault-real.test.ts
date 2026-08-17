import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TreeEntry } from "./github";

/**
 * `vault-real.ts` guarda estado num cache de módulo (`let cache`), então cada
 * teste precisa de uma instância nova do módulo — senão o segundo teste
 * herdaria o cache carregado pelo primeiro. `vi.resetModules()` +
 * reimportação dinâmica em `beforeEach` resolve isso; o mock de `./github`
 * sobrevive ao reset porque `vi.mock` é hoisted e fica registrado à parte.
 */
vi.mock("./github", () => ({
  getGitHubConfig: vi.fn(() => ({
    repo: "usuario/vault",
    branch: "main",
    token: "token-fake",
    subpath: "",
  })),
  listTree: vi.fn(),
  readBlob: vi.fn(),
}));

type Fixture = { path: string; sha: string; size: number; conteudo: string };

const FIXTURES: Fixture[] = [
  {
    path: "Estudos/Redes/TCP.md",
    sha: "sha-tcp",
    size: 500,
    conteudo: "O protocolo TCP faz um handshake de three-way antes de enviar dados.",
  },
  {
    path: "Estudos/Redes/UDP.md",
    sha: "sha-udp",
    size: 500,
    conteudo: "UDP não faz handshake nenhum, é sem conexão.",
  },
  {
    path: "Bem-vindo.md",
    sha: "sha-bemvindo",
    size: 100,
    conteudo: "Nota de boas-vindas do vault.",
  },
  {
    // Maior que MAX_TAMANHO_INDEXAVEL (200_000): não deve entrar na busca por conteúdo.
    path: "Estudos/Grande.md",
    sha: "sha-grande",
    size: 300_000,
    conteudo: "Este arquivo enorme fala sobre unicornioazul só aqui dentro.",
  },
];

/** Configura os mocks de `./github` para devolver as fixtures acima. */
async function configurarGitHubFalso(opts: { truncated?: boolean } = {}) {
  const github = await import("./github");

  const entries: TreeEntry[] = FIXTURES.map((f) => ({
    path: f.path,
    sha: f.sha,
    size: f.size,
  }));

  vi.mocked(github.listTree).mockResolvedValue({
    entries,
    truncated: opts.truncated ?? false,
  });

  vi.mocked(github.readBlob).mockImplementation(async (_cfg, sha: string) => {
    const fixture = FIXTURES.find((f) => f.sha === sha);
    if (!fixture) throw new Error(`sha desconhecido nos testes: ${sha}`);
    return fixture.conteudo;
  });

  return github;
}

/** Reimporta `vault-real.ts` do zero, para começar cada teste com cache limpo. */
async function importarVaultReal() {
  return import("./vault-real");
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

describe("resolverNota", () => {
  it("resolve pelo caminho exato", async () => {
    await configurarGitHubFalso();
    const { resolverNota } = await importarVaultReal();

    const nota = await resolverNota("Estudos/Redes/TCP.md");
    expect(nota?.caminho).toBe("Estudos/Redes/TCP.md");
  });

  it("resolve ignorando .md, caixa e acentuação", async () => {
    await configurarGitHubFalso();
    const { resolverNota } = await importarVaultReal();

    const nota = await resolverNota("estudos/redes/tcp");
    expect(nota?.caminho).toBe("Estudos/Redes/TCP.md");
  });

  it("resolve só pelo título, sem a pasta", async () => {
    await configurarGitHubFalso();
    const { resolverNota } = await importarVaultReal();

    const nota = await resolverNota("TCP");
    expect(nota?.caminho).toBe("Estudos/Redes/TCP.md");
  });

  it("resolve um caminho parcial (sem a primeira pasta)", async () => {
    await configurarGitHubFalso();
    const { resolverNota } = await importarVaultReal();

    const nota = await resolverNota("Redes/TCP");
    expect(nota?.caminho).toBe("Estudos/Redes/TCP.md");
  });

  it("devolve null quando não encontra nada parecido", async () => {
    await configurarGitHubFalso();
    const { resolverNota } = await importarVaultReal();

    const nota = await resolverNota("Nota Que Não Existe De Verdade");
    expect(nota).toBeNull();
  });
});

describe("buscarNotas", () => {
  it("dá score mais alto para nota cujo título bate exatamente com o termo", async () => {
    await configurarGitHubFalso();
    const { buscarNotas } = await importarVaultReal();

    const { resultados } = await buscarNotas("TCP");
    expect(resultados[0]?.caminho).toBe("Estudos/Redes/TCP.md");
  });

  it("encontra pelo conteúdo quando o termo não está no título nem no caminho", async () => {
    await configurarGitHubFalso();
    const { buscarNotas } = await importarVaultReal();

    const { resultados } = await buscarNotas("handshake");
    const caminhos = resultados.map((r) => r.caminho);
    expect(caminhos).toEqual(
      expect.arrayContaining(["Estudos/Redes/TCP.md", "Estudos/Redes/UDP.md"]),
    );
  });

  it("respeita o limite de resultados", async () => {
    await configurarGitHubFalso();
    const { buscarNotas } = await importarVaultReal();

    const { resultados } = await buscarNotas("handshake", 1);
    expect(resultados).toHaveLength(1);
  });

  it("não indexa o conteúdo de notas maiores que MAX_TAMANHO_INDEXAVEL", async () => {
    await configurarGitHubFalso();
    const { buscarNotas } = await importarVaultReal();

    // "unicornioazul" só existe dentro do conteúdo de Estudos/Grande.md, que
    // é grande demais para ser indexado — título e caminho não têm o termo.
    const { resultados } = await buscarNotas("unicornioazul");
    expect(resultados).toHaveLength(0);
  });

  it("avisa quando a listagem do GitHub veio truncada", async () => {
    await configurarGitHubFalso({ truncated: true });
    const { buscarNotas } = await importarVaultReal();

    const { aviso } = await buscarNotas("TCP");
    expect(aviso).toMatch(/incompleta/);
  });

  it("avisa quando a consulta não tem nenhuma palavra pesquisável", async () => {
    await configurarGitHubFalso();
    const { buscarNotas } = await importarVaultReal();

    // "de" e "e" estão na lista de palavras ignoradas / são curtas demais.
    const { resultados, aviso } = await buscarNotas("de e");
    expect(resultados).toHaveLength(0);
    expect(aviso).toMatch(/nenhuma palavra pesquisável/);
  });

  it("não derruba a busca se o download de uma nota falhar", async () => {
    const github = await configurarGitHubFalso();
    // UDP.md falha ao baixar; as outras notas continuam pesquisáveis.
    vi.mocked(github.readBlob).mockImplementation(async (_cfg, sha: string) => {
      if (sha === "sha-udp") throw new Error("falha de rede simulada");
      const fixture = FIXTURES.find((f) => f.sha === sha);
      if (!fixture) throw new Error(`sha desconhecido nos testes: ${sha}`);
      return fixture.conteudo;
    });

    const { buscarNotas } = await importarVaultReal();
    const { resultados } = await buscarNotas("handshake");

    // TCP.md ainda é encontrada pelo conteúdo; UDP.md não (o download falhou).
    expect(resultados.map((r) => r.caminho)).toContain("Estudos/Redes/TCP.md");
    expect(resultados.map((r) => r.caminho)).not.toContain("Estudos/Redes/UDP.md");
  });
});

describe("lerConteudoDaNota", () => {
  it("devolve o conteúdo da nota pelo caminho exato", async () => {
    await configurarGitHubFalso();
    const { lerConteudoDaNota } = await importarVaultReal();

    const conteudo = await lerConteudoDaNota("Bem-vindo.md");
    expect(conteudo).toBe("Nota de boas-vindas do vault.");
  });

  it("devolve null para um caminho que não existe", async () => {
    await configurarGitHubFalso();
    const { lerConteudoDaNota } = await importarVaultReal();

    const conteudo = await lerConteudoDaNota("Nao/Existe.md");
    expect(conteudo).toBeNull();
  });

  it("reaproveita o cache: baixa o mesmo conteúdo só uma vez", async () => {
    const github = await configurarGitHubFalso();
    const { lerConteudoDaNota } = await importarVaultReal();

    await lerConteudoDaNota("Bem-vindo.md");
    await lerConteudoDaNota("Bem-vindo.md");

    expect(github.readBlob).toHaveBeenCalledTimes(1);
  });
});

describe("obterArvoreDoVault", () => {
  it("agrupa os caminhos em pastas e notas", async () => {
    await configurarGitHubFalso();
    const { obterArvoreDoVault } = await importarVaultReal();

    const { itens } = await obterArvoreDoVault();

    const pastaEstudos = itens.find((i) => i.tipo === "pasta" && i.nome === "Estudos");
    expect(pastaEstudos).toBeDefined();

    const notaRaiz = itens.find((i) => i.tipo === "nota" && i.nome === "Bem-vindo");
    expect(notaRaiz).toBeDefined();
  });
});
