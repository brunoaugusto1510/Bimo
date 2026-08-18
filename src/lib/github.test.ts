import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  GitHubError,
  getFileSha,
  getGitHubConfig,
  listTree,
  putFile,
  readBlob,
  type GitHubConfig,
} from "./github";

/**
 * Diferente de `vault-real.test.ts` (que mocka `./github` inteiro), aqui é o
 * `fetch` global que é mockado — o que importa é testar de verdade o helper
 * `request()` interno (headers, método, corpo, tratamento de erro), já que
 * `getFileSha`/`putFile` são novos nesta fase e ninguém mais testa essa parte.
 */

const CFG: GitHubConfig = {
  repo: "usuario/vault",
  branch: "main",
  token: "token-fake",
  subpath: "",
};

function respostaFalsa(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("getGitHubConfig", () => {
  const ENV_ORIGINAL = { ...process.env };

  afterEach(() => {
    process.env = { ...ENV_ORIGINAL };
  });

  it("lê repo/token/branch/subpath das variáveis de ambiente", () => {
    process.env.VAULT_REPO = "usuario/vault";
    process.env.GITHUB_TOKEN = "token-fake";
    process.env.VAULT_BRANCH = "dev";
    process.env.VAULT_SUBPATH = "/Notas/";

    expect(getGitHubConfig()).toEqual({
      repo: "usuario/vault",
      token: "token-fake",
      branch: "dev",
      // Barras no começo/fim são removidas.
      subpath: "Notas",
    });
  });

  it("usa 'main' como branch padrão e raiz como subpath padrão", () => {
    process.env.VAULT_REPO = "usuario/vault";
    process.env.GITHUB_TOKEN = "token-fake";
    delete process.env.VAULT_BRANCH;
    delete process.env.VAULT_SUBPATH;

    const cfg = getGitHubConfig();
    expect(cfg.branch).toBe("main");
    expect(cfg.subpath).toBe("");
  });

  it("lança um erro claro quando VAULT_REPO não está definido", () => {
    delete process.env.VAULT_REPO;
    process.env.GITHUB_TOKEN = "token-fake";

    expect(() => getGitHubConfig()).toThrow(/VAULT_REPO não está definido/);
  });

  it("lança um erro claro quando VAULT_REPO não está no formato dono/repositorio", () => {
    process.env.VAULT_REPO = "isso-nao-tem-barra";
    process.env.GITHUB_TOKEN = "token-fake";

    expect(() => getGitHubConfig()).toThrow(/formato errado/);
  });

  it("lança um erro claro quando GITHUB_TOKEN não está definido", () => {
    process.env.VAULT_REPO = "usuario/vault";
    delete process.env.GITHUB_TOKEN;

    expect(() => getGitHubConfig()).toThrow(/GITHUB_TOKEN não está definido/);
  });
});

describe("listTree", () => {
  it("filtra só os blobs e devolve path/sha/size", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        respostaFalsa({
          tree: [
            { path: "A.md", type: "blob", sha: "s1", size: 10 },
            { path: "Pasta", type: "tree", sha: "s2" },
          ],
          truncated: false,
        }),
      ),
    );

    const { entries, truncated } = await listTree(CFG);
    expect(entries).toEqual([{ path: "A.md", sha: "s1", size: 10 }]);
    expect(truncated).toBe(false);
  });

  it("lança GitHubError com o status quando o GitHub responde com erro", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("boom", { status: 500 })));

    await expect(listTree(CFG)).rejects.toThrow(GitHubError);
  });
});

describe("readBlob", () => {
  it("pede o Accept 'raw' e devolve o texto puro", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("# Conteúdo"));
    vi.stubGlobal("fetch", fetchMock);

    const texto = await readBlob(CFG, "sha-1");

    expect(texto).toBe("# Conteúdo");
    const [, opcoes] = fetchMock.mock.calls[0];
    expect(opcoes.headers.Accept).toBe("application/vnd.github.raw");
  });
});

describe("getFileSha", () => {
  it("devolve o sha quando o arquivo existe", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respostaFalsa({ sha: "sha-existente" })));

    const sha = await getFileSha(CFG, "Estudos/TCP.md");
    expect(sha).toBe("sha-existente");
  });

  it("devolve null quando o arquivo não existe (404)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("not found", { status: 404 })));

    const sha = await getFileSha(CFG, "Nao/Existe.md");
    expect(sha).toBeNull();
  });

  it("repropaga outros erros (ex: 500) em vez de tratar como 'não existe'", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("boom", { status: 500 })));

    await expect(getFileSha(CFG, "Estudos/TCP.md")).rejects.toThrow(GitHubError);
  });
});

describe("putFile", () => {
  it("manda PUT com o conteúdo em base64, a branch e o sha (quando informado)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      respostaFalsa({
        content: { sha: "sha-novo" },
        commit: { html_url: "https://github.com/usuario/vault/commit/abc" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const resultado = await putFile(CFG, {
      path: "Estudos/TCP.md",
      content: "# TCP",
      message: "Atualiza nota: Estudos/TCP.md",
      sha: "sha-antigo",
    });

    expect(resultado).toEqual({
      commitUrl: "https://github.com/usuario/vault/commit/abc",
      sha: "sha-novo",
    });

    const [url, opcoes] = fetchMock.mock.calls[0];
    expect(url).toContain("/repos/usuario/vault/contents/Estudos/TCP.md");
    expect(opcoes.method).toBe("PUT");

    const corpo = JSON.parse(opcoes.body);
    expect(corpo).toEqual({
      message: "Atualiza nota: Estudos/TCP.md",
      content: Buffer.from("# TCP", "utf8").toString("base64"),
      branch: "main",
      sha: "sha-antigo",
    });
  });

  it("não manda 'sha' no corpo quando não informado (criação de nota nova)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      respostaFalsa({ content: { sha: "s" }, commit: { html_url: "url" } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await putFile(CFG, { path: "Nova.md", content: "conteúdo", message: "Cria nota: Nova.md" });

    const [, opcoes] = fetchMock.mock.calls[0];
    const corpo = JSON.parse(opcoes.body);
    expect(corpo).not.toHaveProperty("sha");
  });
});
