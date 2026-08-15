/**
 * Transforma a árvore de arquivos do repositório do GitHub numa árvore de
 * pastas/notas (`ItemVault[]`) — o mesmo formato que `vault-exemplo.ts` usava.
 *
 * Guarda o resultado em cache por alguns minutos: cada visita à página não
 * precisa refazer a chamada ao GitHub, e o preço é que uma nota criada direto
 * no Obsidian pode levar até `CACHE_TTL_MS` para aparecer aqui.
 */

import { getGitHubConfig, listTree, type GitHubConfig } from "./github";
import type { ItemVault } from "./types";

const CACHE_TTL_MS = 5 * 60 * 1000;

type Cache = {
  carregadoEm: number;
  itens: ItemVault[];
  truncado: boolean;
};

// Vive fora de qualquer função: sobrevive entre requisições no mesmo processo.
let cache: Cache | null = null;

function ehNota(path: string, cfg: GitHubConfig): boolean {
  if (!path.toLowerCase().endsWith(".md")) return false;
  // Arquivos internos do Obsidian (configuração, plugins, lixeira) não são notas.
  if (/(^|\/)\.(obsidian|trash|git)(\/|$)/i.test(path)) return false;
  if (cfg.subpath && !path.startsWith(`${cfg.subpath}/`)) return false;
  return true;
}

/** Remove o prefixo da subpasta: a árvore mostrada só conhece caminhos relativos ao vault. */
function paraCaminhoVault(path: string, cfg: GitHubConfig): string {
  return cfg.subpath ? path.slice(cfg.subpath.length + 1) : path;
}

/**
 * Agrupa uma lista plana de caminhos ("Faculdade/Redes/TCP.md") numa árvore
 * de pastas. A ideia: cada pasta é uma entrada num Map (por nome), e cada
 * caminho vai "descendo" um nível de cada vez, criando a pasta se ainda não
 * existir.
 */
function construirArvore(caminhos: string[]): ItemVault[] {
  type NoPasta = { nome: string; filhos: Map<string, NoPasta>; notas: string[] };

  const raiz: NoPasta = { nome: "", filhos: new Map(), notas: [] };

  for (const caminho of caminhos) {
    const partes = caminho.split("/");
    const nomeArquivo = partes.pop()!;

    let atual = raiz;
    for (const parte of partes) {
      let filho = atual.filhos.get(parte);
      if (!filho) {
        filho = { nome: parte, filhos: new Map(), notas: [] };
        atual.filhos.set(parte, filho);
      }
      atual = filho;
    }
    atual.notas.push(nomeArquivo);
  }

  // Converte o Map intermediário no formato final ItemVault, pasta por pasta,
  // ordenando pastas e notas por nome (igual ao Obsidian mostra por padrão).
  function paraItens(no: NoPasta, prefixo: string): ItemVault[] {
    const pastas: ItemVault[] = [...no.filhos.values()]
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
      .map((filho) => ({
        tipo: "pasta" as const,
        nome: filho.nome,
        filhos: paraItens(filho, prefixo ? `${prefixo}/${filho.nome}` : filho.nome),
      }));

    const notas: ItemVault[] = no.notas
      .sort((a, b) => a.localeCompare(b, "pt-BR"))
      .map((nomeArquivo) => ({
        tipo: "nota" as const,
        nome: nomeArquivo.replace(/\.md$/i, ""),
        caminho: prefixo ? `${prefixo}/${nomeArquivo}` : nomeArquivo,
      }));

    return [...pastas, ...notas];
  }

  return paraItens(raiz, "");
}

/** Busca a árvore do vault, usando o cache quando possível. */
export async function obterArvoreDoVault(): Promise<{
  itens: ItemVault[];
  aviso?: string;
}> {
  if (cache && Date.now() - cache.carregadoEm < CACHE_TTL_MS) {
    return { itens: cache.itens, aviso: cache.truncado ? avisoTruncamento() : undefined };
  }

  const cfg = getGitHubConfig();
  const { entries, truncated } = await listTree(cfg);

  const caminhos = entries
    .filter((entry) => ehNota(entry.path, cfg))
    .map((entry) => paraCaminhoVault(entry.path, cfg));

  const itens = construirArvore(caminhos);

  cache = { carregadoEm: Date.now(), itens, truncado: truncated };
  return { itens, aviso: truncated ? avisoTruncamento() : undefined };
}

function avisoTruncamento(): string {
  return "O repositório é grande demais e a listagem de arquivos veio incompleta.";
}
