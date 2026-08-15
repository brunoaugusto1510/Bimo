/**
 * Transforma a árvore de arquivos do repositório do GitHub numa árvore de
 * pastas/notas (`ItemVault[]`) — o mesmo formato que `vault-exemplo.ts` usava.
 *
 * Guarda o resultado em cache por alguns minutos: cada visita à página não
 * precisa refazer a chamada ao GitHub, e o preço é que uma nota criada direto
 * no Obsidian pode levar até `CACHE_TTL_MS` para aparecer aqui. Toda escrita
 * (quando ela existir, na Etapa 5) vai precisar invalidar esse cache.
 */

import { getGitHubConfig, listTree, readBlob, type GitHubConfig } from "./github";
import type { ItemVault } from "./types";

const CACHE_TTL_MS = 5 * 60 * 1000;

/** Uma nota, sem conteúdo carregado ainda — só o suficiente para montar a árvore ou pedir o conteúdo depois. */
export type NotaPlana = { caminho: string; sha: string };

type Cache = {
  carregadoEm: number;
  notas: NotaPlana[];
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

/** Remove o prefixo da subpasta: o resto do app só conhece caminhos relativos ao vault. */
function paraCaminhoVault(path: string, cfg: GitHubConfig): string {
  return cfg.subpath ? path.slice(cfg.subpath.length + 1) : path;
}

/**
 * A lista plana de notas (caminho + sha), usada tanto para montar a árvore
 * da barra lateral quanto para o grafo de links e a leitura de conteúdo.
 * É a única função aqui que fala com a API do GitHub.
 */
export async function obterNotasPlanas(): Promise<{ notas: NotaPlana[]; aviso?: string }> {
  if (cache && Date.now() - cache.carregadoEm < CACHE_TTL_MS) {
    return { notas: cache.notas, aviso: cache.truncado ? avisoTruncamento() : undefined };
  }

  const cfg = getGitHubConfig();
  const { entries, truncated } = await listTree(cfg);

  const notas = entries
    .filter((entry) => ehNota(entry.path, cfg))
    .map((entry) => ({ caminho: paraCaminhoVault(entry.path, cfg), sha: entry.sha }));

  cache = { carregadoEm: Date.now(), notas, truncado: truncated };
  return { notas, aviso: truncated ? avisoTruncamento() : undefined };
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

/** Busca a árvore do vault (para a barra lateral), usando o cache quando possível. */
export async function obterArvoreDoVault(): Promise<{
  itens: ItemVault[];
  aviso?: string;
}> {
  const { notas, aviso } = await obterNotasPlanas();
  const itens = construirArvore(notas.map((n) => n.caminho));
  return { itens, aviso };
}

/** Lê o conteúdo de uma nota específica, para o painel de leitura. `null` se ela não existir. */
export async function lerConteudoDaNota(caminho: string): Promise<string | null> {
  const { notas } = await obterNotasPlanas();
  const nota = notas.find((n) => n.caminho === caminho);
  if (!nota) return null;

  const cfg = getGitHubConfig();
  return readBlob(cfg, nota.sha);
}

function avisoTruncamento(): string {
  return "O repositório é grande demais e a listagem de arquivos veio incompleta.";
}
