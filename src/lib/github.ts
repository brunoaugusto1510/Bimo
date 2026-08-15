/**
 * Fala HTTP com a API REST do GitHub.
 *
 * Nada aqui sabe o que é uma "nota" ou o que é o Obsidian — isso fica em
 * `vault-real.ts`. Aqui só existem repositórios, branches e árvores de arquivo.
 *
 * Por enquanto só lê (`listTree`). Ler o conteúdo de um arquivo e escrever
 * commits fica para as etapas em que o Gemini precisar disso de verdade —
 * veja `etapas-futuras/github.ts` para essa versão mais completa.
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

async function request(cfg: GitHubConfig, path: string): Promise<Response> {
  const res = await fetch(`${GITHUB_API}${path}`, {
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "bimo-vault-chat",
    },
    // Sempre buscar do GitHub: o cache é nosso (vault-real.ts), não do fetch.
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
    tree?: Array<{ path: string; type: string; size?: number }>;
    truncated?: boolean;
  };

  const entries = (data.tree ?? [])
    // "blob" = arquivo. O outro tipo é "tree" (pasta), que não interessa aqui:
    // a estrutura de pastas é reconstruída a partir dos caminhos dos arquivos.
    .filter((item) => item.type === "blob")
    .map((item) => ({ path: item.path, size: item.size ?? 0 }));

  return { entries, truncated: data.truncated ?? false };
}
