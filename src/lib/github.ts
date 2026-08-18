/**
 * Fala HTTP com a API REST do GitHub.
 *
 * Nada aqui sabe o que é uma "nota" ou o que é o Obsidian, nem o que é um
 * grafo de links — isso fica em `vault-real.ts` e `grafo.ts`. Aqui só existem
 * repositórios, branches, árvores de arquivo, blobs e commits.
 */

const GITHUB_API = "https://api.github.com";

export type GitHubConfig = {
  /** Formato "dono/repositorio", ex: "bruno/meu-vault" */
  repo: string;
  branch: string;
  token: string;
  /** Subpasta dentro do repo onde ficam as notas ("" = raiz) */
  subpath: string;
};

/**
 * Lê as variáveis de ambiente uma única vez e falha com uma mensagem clara
 * se algo estiver faltando (erro comum de configuração).
 */
export function getGitHubConfig(): GitHubConfig {
  const repo = process.env.VAULT_REPO;
  const token = process.env.GITHUB_TOKEN;

  if (!repo) {
    throw new Error(
      "VAULT_REPO não está definido. Adicione no .env.local, ex: VAULT_REPO=seu-usuario/seu-vault",
    );
  }
  if (!/^[^/\s]+\/[^/\s]+$/.test(repo)) {
    throw new Error(
      `VAULT_REPO="${repo}" está no formato errado. Use "dono/repositorio".`,
    );
  }
  if (!token) {
    throw new Error(
      "GITHUB_TOKEN não está definido. Crie um Personal Access Token no GitHub e adicione no .env.local.",
    );
  }

  return {
    repo,
    token,
    branch: process.env.VAULT_BRANCH || "main",
    // Normaliza: remove barras no começo/fim para não gerar caminhos com "//"
    subpath: (process.env.VAULT_SUBPATH || "").replace(/^\/+|\/+$/g, ""),
  };
}

/** Erro com o status HTTP preservado, para dar mensagens melhores lá em cima. */
export class GitHubError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "GitHubError";
  }
}

type RequestOptions = {
  method?: "GET" | "PUT";
  body?: unknown;
  /** Header Accept — "raw" faz o GitHub devolver o arquivo em texto puro. */
  accept?: string;
};

async function request(
  cfg: GitHubConfig,
  path: string,
  options: RequestOptions = {},
): Promise<Response> {
  const res = await fetch(`${GITHUB_API}${path}`, {
    method: options.method ?? "GET",
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      Accept: options.accept ?? "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "bimo-vault-chat",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    // Sempre buscar do GitHub: o cache é nosso (vault-real.ts / grafo.ts), não do fetch.
    cache: "no-store",
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new GitHubError(
      `GitHub respondeu ${res.status} em ${path}: ${detail.slice(0, 300)}`,
      res.status,
    );
  }

  return res;
}

export type TreeEntry = {
  /** Caminho completo dentro do repositório */
  path: string;
  /** Hash do conteúdo — é o que `readBlob` usa para baixar o arquivo */
  sha: string;
  size: number;
};

/**
 * Baixa a árvore inteira de arquivos do repositório numa única chamada.
 *
 * Devolve também `truncated`: o GitHub corta a resposta em repositórios
 * gigantes (~100k arquivos), e é melhor avisar do que fingir que veio tudo.
 */
export async function listTree(
  cfg: GitHubConfig,
): Promise<{ entries: TreeEntry[]; truncated: boolean }> {
  const res = await request(
    cfg,
    `/repos/${cfg.repo}/git/trees/${encodeURIComponent(cfg.branch)}?recursive=1`,
  );
  const data = (await res.json()) as {
    tree?: Array<{ path: string; type: string; sha: string; size?: number }>;
    truncated?: boolean;
  };

  const entries = (data.tree ?? [])
    // "blob" = arquivo. O outro tipo é "tree" (pasta), que não interessa aqui:
    // a estrutura de pastas é reconstruída a partir dos caminhos dos arquivos.
    .filter((item) => item.type === "blob")
    .map((item) => ({ path: item.path, sha: item.sha, size: item.size ?? 0 }));

  return { entries, truncated: data.truncated ?? false };
}

/** Baixa o conteúdo de um arquivo pelo hash do blob (texto puro). */
export async function readBlob(cfg: GitHubConfig, sha: string): Promise<string> {
  const res = await request(cfg, `/repos/${cfg.repo}/git/blobs/${sha}`, {
    accept: "application/vnd.github.raw",
  });
  return res.text();
}

/**
 * O sha que o GitHub exige ao sobrescrever um arquivo existente.
 * Devolve `null` se o arquivo ainda não existe (aí é criação, não edição).
 */
export async function getFileSha(cfg: GitHubConfig, path: string): Promise<string | null> {
  try {
    const res = await request(
      cfg,
      `/repos/${cfg.repo}/contents/${encodePath(path)}?ref=${encodeURIComponent(cfg.branch)}`,
    );
    const data = (await res.json()) as { sha?: string };
    return data.sha ?? null;
  } catch (error) {
    if (error instanceof GitHubError && error.status === 404) return null;
    throw error;
  }
}

/**
 * Cria ou sobrescreve um arquivo — isso gera um commit de verdade no repo.
 *
 * `sha` deve ser o hash atual do arquivo ao editar. Se estiver desatualizado
 * o GitHub devolve 409, o que evita sobrescrever uma alteração feita no
 * Obsidian entre a leitura e a escrita.
 */
export async function putFile(
  cfg: GitHubConfig,
  params: { path: string; content: string; message: string; sha?: string },
): Promise<{ commitUrl: string; sha: string }> {
  const res = await request(cfg, `/repos/${cfg.repo}/contents/${encodePath(params.path)}`, {
    method: "PUT",
    body: {
      message: params.message,
      // A API de conteúdo do GitHub só aceita o arquivo em base64.
      content: Buffer.from(params.content, "utf8").toString("base64"),
      branch: cfg.branch,
      ...(params.sha ? { sha: params.sha } : {}),
    },
  });

  const data = (await res.json()) as {
    content?: { sha?: string };
    commit?: { html_url?: string };
  };

  return {
    commitUrl: data.commit?.html_url ?? "",
    sha: data.content?.sha ?? "",
  };
}

/** Codifica cada segmento do caminho, mas mantém as barras separando pastas. */
function encodePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}
