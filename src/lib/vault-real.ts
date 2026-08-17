/**
 * Transforma a árvore de arquivos do repositório do GitHub numa árvore de
 * pastas/notas (`ItemVault[]`) — o mesmo formato que `vault-exemplo.ts` usava.
 *
 * Também é a camada que o agente (Etapa 4) usa para buscar e ler notas: o
 * cache de conteúdo baixado sob demanda é compartilhado entre a busca, a
 * leitura de uma nota específica e a resolução de caminhos aproximados.
 *
 * Guarda o resultado em cache por alguns minutos: cada visita à página não
 * precisa refazer a chamada ao GitHub, e o preço é que uma nota criada direto
 * no Obsidian pode levar até `CACHE_TTL_MS` para aparecer aqui. Toda escrita
 * (quando ela existir, na Etapa 5) vai precisar invalidar esse cache.
 */

import { getGitHubConfig, listTree, readBlob, type GitHubConfig } from "./github";
import type { ItemVault } from "./types";

const CACHE_TTL_MS = 5 * 60 * 1000;
/** Teto de notas cujo conteúdo baixamos para a busca — protege contra vaults enormes. */
const MAX_NOTAS_INDEXADAS = 800;
/** Notas maiores que isso não entram na busca por conteúdo (mas seguem legíveis). */
const MAX_TAMANHO_INDEXAVEL = 200_000;
/** Quantos downloads de nota rodam ao mesmo tempo. */
const CONCORRENCIA = 8;

/** Uma nota, sem conteúdo carregado ainda — só o suficiente para montar a árvore ou pedir o conteúdo depois. */
export type NotaPlana = { caminho: string; sha: string; tamanho: number };

type Cache = {
  carregadoEm: number;
  notas: NotaPlana[];
  truncado: boolean;
  /** Conteúdo já baixado, indexado por caminho. Cresce sob demanda. */
  conteudos: Map<string, string>;
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
 * Garante que o cache está carregado e em dia, buscando a árvore do GitHub
 * de novo se estiver vencido. É a única função aqui que fala com a API do
 * GitHub para listar arquivos — todo o resto (árvore da barra lateral,
 * busca, leitura, resolução de caminho) parte dela.
 */
async function garantirCache(): Promise<Cache> {
  if (cache && Date.now() - cache.carregadoEm < CACHE_TTL_MS) {
    return cache;
  }

  const cfg = getGitHubConfig();
  const { entries, truncated } = await listTree(cfg);

  const notas = entries
    .filter((entry) => ehNota(entry.path, cfg))
    .map((entry) => ({
      caminho: paraCaminhoVault(entry.path, cfg),
      sha: entry.sha,
      tamanho: entry.size,
    }));

  // Cache novo -> conteúdo baixado antes pode estar amarrado a shas velhos
  // (nota mudou de conteúdo). Por isso o mapa de conteúdos começa vazio,
  // não é reaproveitado do cache anterior.
  cache = { carregadoEm: Date.now(), notas, truncado: truncated, conteudos: new Map() };
  return cache;
}

/**
 * A lista plana de notas (caminho + sha), usada tanto para montar a árvore
 * da barra lateral quanto para o grafo de links e a leitura de conteúdo.
 */
export async function obterNotasPlanas(): Promise<{ notas: NotaPlana[]; aviso?: string }> {
  const c = await garantirCache();
  return { notas: c.notas, aviso: c.truncado ? avisoTruncamento() : undefined };
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

/** Baixa (ou reaproveita do cache) o conteúdo de uma nota já conhecida. */
async function carregarConteudo(nota: NotaPlana): Promise<string> {
  const c = await garantirCache();
  const emCache = c.conteudos.get(nota.caminho);
  if (emCache !== undefined) return emCache;

  const cfg = getGitHubConfig();
  const texto = await readBlob(cfg, nota.sha);
  c.conteudos.set(nota.caminho, texto);
  return texto;
}

/** Lê o conteúdo de uma nota específica, para o painel de leitura. `null` se ela não existir. */
export async function lerConteudoDaNota(caminho: string): Promise<string | null> {
  const { notas } = await obterNotasPlanas();
  const nota = notas.find((n) => n.caminho === caminho);
  if (!nota) return null;

  return carregarConteudo(nota);
}

/** Nome do arquivo sem a extensão — é como a nota aparece no Obsidian. */
function tituloDoCaminho(caminho: string): string {
  return caminho.split("/").pop()!.replace(/\.md$/i, "");
}

/** Minúsculas e sem acentos — "Álgebra" e "algebra" precisam casar. */
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/**
 * Encontra a nota que o agente quis dizer a partir de um caminho aproximado.
 *
 * O Gemini erra o caminho com frequência: esquece o ".md", troca maiúsculas,
 * ou passa só o título sem a pasta. Em vez de devolver "não encontrado" e
 * gastar mais um turno, tentamos resolver aqui — do mais exato ao mais frouxo.
 */
export async function resolverNota(entrada: string): Promise<NotaPlana | null> {
  const { notas } = await obterNotasPlanas();
  const alvo = normalizar(entrada.replace(/^\/+/, "").replace(/\.md$/i, ""));

  const semExtensao = (caminho: string) => normalizar(caminho.replace(/\.md$/i, ""));
  const titulo = (caminho: string) => normalizar(tituloDoCaminho(caminho));

  return (
    notas.find((n) => semExtensao(n.caminho) === alvo) ??
    notas.find((n) => titulo(n.caminho) === alvo) ??
    notas.find((n) => semExtensao(n.caminho).endsWith(`/${alvo}`)) ??
    notas.find((n) => titulo(n.caminho).includes(alvo)) ??
    null
  );
}

export type ResultadoBusca = NotaPlana & {
  titulo: string;
  /** Trecho do texto ao redor da primeira ocorrência, para dar contexto */
  trecho: string;
  score: number;
};

const PALAVRAS_IGNORADAS = new Set([
  "a", "o", "as", "os", "de", "da", "do", "das", "dos", "e", "em", "no", "na",
  "nos", "nas", "um", "uma", "para", "por", "com", "que", "qual", "quais",
  "sobre", "meu", "minha", "meus", "minhas", "the", "of", "and", "to", "in",
]);

function extrairTermos(consulta: string): string[] {
  return [
    ...new Set(
      normalizar(consulta)
        .split(/[^\p{L}\p{N}]+/u)
        .filter((t) => t.length >= 3 && !PALAVRAS_IGNORADAS.has(t)),
    ),
  ];
}

function contarOcorrencias(texto: string, termo: string): number {
  let total = 0;
  let posicao = texto.indexOf(termo);
  while (posicao !== -1) {
    total += 1;
    posicao = texto.indexOf(termo, posicao + termo.length);
  }
  return total;
}

/** Pega ~280 caracteres em volta do primeiro termo encontrado. */
function montarTrecho(conteudo: string, termos: string[]): string {
  if (!conteudo) return "";
  const normalizado = normalizar(conteudo);

  let posicao = -1;
  for (const termo of termos) {
    const encontrado = normalizado.indexOf(termo);
    if (encontrado !== -1 && (posicao === -1 || encontrado < posicao)) {
      posicao = encontrado;
    }
  }

  const inicio = Math.max(0, (posicao === -1 ? 0 : posicao) - 100);
  const trecho = conteudo.slice(inicio, inicio + 280).replace(/\s+/g, " ").trim();

  return `${inicio > 0 ? "…" : ""}${trecho}${inicio + 280 < conteudo.length ? "…" : ""}`;
}

/** Baixa conteúdos em paralelo, respeitando um limite de requisições simultâneas. */
async function carregarEmLote(notas: NotaPlana[]): Promise<void> {
  const c = await garantirCache();
  const pendentes = notas.filter((n) => !c.conteudos.has(n.caminho));
  if (pendentes.length === 0) return;

  const fila = [...pendentes];
  const trabalhadores = Array.from(
    { length: Math.min(CONCORRENCIA, fila.length) },
    async () => {
      while (fila.length > 0) {
        const nota = fila.shift();
        if (!nota) return;
        try {
          await carregarConteudo(nota);
        } catch {
          // Uma nota que falhou não pode derrubar a busca inteira.
          c.conteudos.set(nota.caminho, "");
        }
      }
    },
  );

  await Promise.all(trabalhadores);
}

/**
 * Busca por palavras no título, no caminho e no conteúdo das notas.
 *
 * Não é busca semântica — é correspondência de palavras com pesos. Para o
 * MVP funciona bem, e o Gemini compensa reformulando a consulta quando não
 * acha.
 */
export async function buscarNotas(
  consulta: string,
  limite = 8,
): Promise<{ resultados: ResultadoBusca[]; aviso?: string }> {
  const c = await garantirCache();
  const termos = extrairTermos(consulta);

  if (termos.length === 0) {
    return { resultados: [], aviso: "A consulta não tinha nenhuma palavra pesquisável." };
  }

  // Notas grandes demais entram na busca só pelo título/caminho.
  const indexaveis = c.notas
    .filter((n) => n.tamanho <= MAX_TAMANHO_INDEXAVEL)
    .slice(0, MAX_NOTAS_INDEXADAS);

  await carregarEmLote(indexaveis);

  const resultados: ResultadoBusca[] = [];

  for (const nota of c.notas) {
    const conteudo = c.conteudos.get(nota.caminho) ?? "";
    const titulo = tituloDoCaminho(nota.caminho);
    const tituloNorm = normalizar(titulo);
    const caminhoNorm = normalizar(nota.caminho);
    const conteudoNorm = normalizar(conteudo);

    let score = 0;
    let termosEncontrados = 0;

    for (const termo of termos) {
      let pontuouEsteTermo = false;

      if (tituloNorm.includes(termo)) {
        // Título é o sinal mais forte: no Obsidian ele carrega o assunto da nota.
        score += tituloNorm === termo ? 30 : 12;
        pontuouEsteTermo = true;
      }
      if (caminhoNorm.includes(termo)) {
        score += 4;
        pontuouEsteTermo = true;
      }

      const ocorrencias = contarOcorrencias(conteudoNorm, termo);
      if (ocorrencias > 0) {
        // Limitado a 5: uma nota que repete a palavra 200 vezes não é 200x melhor.
        score += Math.min(ocorrencias, 5);
        pontuouEsteTermo = true;
      }

      if (pontuouEsteTermo) termosEncontrados += 1;
    }

    if (score === 0) continue;

    // Bônus para notas que cobrem TODOS os termos da pergunta.
    if (termosEncontrados === termos.length && termos.length > 1) score *= 1.5;

    resultados.push({
      ...nota,
      titulo,
      score,
      trecho: montarTrecho(conteudo, termos),
    });
  }

  resultados.sort((a, b) => b.score - a.score);

  const aviso = c.truncado
    ? avisoTruncamento()
    : c.notas.length > MAX_NOTAS_INDEXADAS
      ? `O vault tem ${c.notas.length} notas; a busca por conteúdo cobriu as primeiras ${MAX_NOTAS_INDEXADAS}.`
      : undefined;

  return { resultados: resultados.slice(0, limite), aviso };
}

function avisoTruncamento(): string {
  return "O repositório é grande demais e a listagem de arquivos veio incompleta.";
}
