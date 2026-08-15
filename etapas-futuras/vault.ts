/**
 * A camada "Vault": transforma o repositório do GitHub num conjunto de notas
 * do Obsidian que dá para listar, buscar, ler e escrever.
 *
 * Sobre o cache: a lista de arquivos e o conteúdo já baixado ficam guardados
 * na memória do processo por alguns minutos. Isso deixa a busca rápida e
 * economiza chamadas na API do GitHub. O preço é que uma nota editada
 * direto no Obsidian pode levar até `CACHE_TTL_MS` para aparecer aqui —
 * por isso toda escrita nossa invalida o cache na hora.
 */

import {
  getFileSha,
  getGitHubConfig,
  listTree,
  putFile,
  readBlob,
  type GitHubConfig,
  type TreeEntry,
} from "./github";

/** Por quanto tempo confiamos na lista de arquivos em cache. */
const CACHE_TTL_MS = 5 * 60 * 1000;
/** Teto de notas cujo conteúdo baixamos para busca — protege contra vaults enormes. */
const MAX_NOTES_INDEXADAS = 800;
/** Notas maiores que isso não entram na busca por conteúdo (mas seguem legíveis). */
const MAX_TAMANHO_INDEXAVEL = 200_000;
/** Quantos downloads de nota rodam ao mesmo tempo. */
const CONCORRENCIA = 8;

export type Nota = {
  /** Caminho relativo ao vault, ex: "Estudos/Redes/TCP.md" */
  caminho: string;
  /** Nome do arquivo sem a extensão — é como a nota aparece no Obsidian */
  titulo: string;
  sha: string;
  tamanho: number;
};

export type ResultadoBusca = Nota & {
  /** Trecho do texto ao redor da primeira ocorrência, para dar contexto */
  trecho: string;
  score: number;
};

type CacheVault = {
  carregadoEm: number;
  notas: Nota[];
  /** Conteúdo já baixado, indexado por caminho. Cresce sob demanda. */
  conteudos: Map<string, string>;
  truncado: boolean;
};

// Vive fora de qualquer função: sobrevive entre requisições no mesmo processo.
let cache: CacheVault | null = null;

/** Descarta o cache. Chamado depois de toda escrita. */
export function invalidarCache(): void {
  cache = null;
}

function ehNota(entry: TreeEntry, cfg: GitHubConfig): boolean {
  if (!entry.path.toLowerCase().endsWith(".md")) return false;
  // Arquivos internos do Obsidian (configuração, plugins, lixeira) não são notas.
  if (/(^|\/)\.(obsidian|trash|git)(\/|$)/i.test(entry.path)) return false;
  if (cfg.subpath && !entry.path.startsWith(`${cfg.subpath}/`)) return false;
  return true;
}

/** Remove o prefixo da subpasta para o modelo só ver caminhos relativos ao vault. */
function paraCaminhoVault(path: string, cfg: GitHubConfig): string {
  if (!cfg.subpath) return path;
  return path.slice(cfg.subpath.length + 1);
}

/** Caminho do vault -> caminho real dentro do repositório. */
function paraCaminhoRepo(caminho: string, cfg: GitHubConfig): string {
  return cfg.subpath ? `${cfg.subpath}/${caminho}` : caminho;
}

async function getCache(): Promise<CacheVault> {
  if (cache && Date.now() - cache.carregadoEm < CACHE_TTL_MS) {
    return cache;
  }

  const cfg = getGitHubConfig();
  const { entries, truncated } = await listTree(cfg);

  const notas = entries
    .filter((entry) => ehNota(entry, cfg))
    .map((entry) => {
      const caminho = paraCaminhoVault(entry.path, cfg);
      return {
        caminho,
        titulo: caminho.split("/").pop()!.replace(/\.md$/i, ""),
        sha: entry.sha,
        tamanho: entry.size,
      };
    })
    .sort((a, b) => a.caminho.localeCompare(b.caminho, "pt-BR"));

  cache = { carregadoEm: Date.now(), notas, conteudos: new Map(), truncado: truncated };
  return cache;
}

/** Lista as notas do vault, opcionalmente filtrando por pasta. */
export async function listarNotas(pasta?: string): Promise<Nota[]> {
  const { notas } = await getCache();
  if (!pasta) return notas;

  const prefixo = normalizar(pasta.replace(/^\/+|\/+$/g, ""));
  return notas.filter((nota) => normalizar(nota.caminho).startsWith(prefixo));
}

/**
 * Encontra a nota que o modelo quis dizer.
 *
 * O Gemini erra o caminho com frequência: esquece o ".md", troca maiúsculas,
 * ou passa só o título sem a pasta. Em vez de devolver "não encontrado" e
 * gastar mais um turno, tentamos resolver aqui — do mais exato ao mais frouxo.
 */
export async function resolverNota(entrada: string): Promise<Nota | null> {
  const { notas } = await getCache();
  const alvo = normalizar(entrada.replace(/^\/+/, "").replace(/\.md$/i, ""));

  const semExtensao = (caminho: string) => normalizar(caminho.replace(/\.md$/i, ""));

  return (
    notas.find((n) => semExtensao(n.caminho) === alvo) ??
    notas.find((n) => normalizar(n.titulo) === alvo) ??
    notas.find((n) => semExtensao(n.caminho).endsWith(`/${alvo}`)) ??
    notas.find((n) => normalizar(n.titulo).includes(alvo)) ??
    null
  );
}

/** Lê o conteúdo de uma nota, usando o cache quando possível. */
export async function lerNota(
  entrada: string,
): Promise<{ nota: Nota; conteudo: string } | null> {
  const nota = await resolverNota(entrada);
  if (!nota) return null;

  const conteudo = await carregarConteudo(nota);
  return { nota, conteudo };
}

async function carregarConteudo(nota: Nota): Promise<string> {
  const c = await getCache();
  const emCache = c.conteudos.get(nota.caminho);
  if (emCache !== undefined) return emCache;

  const cfg = getGitHubConfig();
  const texto = await readBlob(cfg, nota.sha);
  c.conteudos.set(nota.caminho, texto);
  return texto;
}

/**
 * Busca por palavras no título, no caminho e no conteúdo das notas.
 *
 * Não é busca semântica — é correspondência de palavras com pesos. Para o MVP
 * funciona bem, e o Gemini compensa reformulando a consulta quando não acha.
 */
export async function buscarNotas(
  consulta: string,
  limite = 8,
): Promise<{ resultados: ResultadoBusca[]; aviso?: string }> {
  const c = await getCache();
  const termos = extrairTermos(consulta);

  if (termos.length === 0) {
    return { resultados: [], aviso: "A consulta não tinha nenhuma palavra pesquisável." };
  }

  // Notas grandes demais entram na busca só pelo título/caminho.
  const indexaveis = c.notas
    .filter((n) => n.tamanho <= MAX_TAMANHO_INDEXAVEL)
    .slice(0, MAX_NOTES_INDEXADAS);

  await carregarEmLote(indexaveis);

  const resultados: ResultadoBusca[] = [];

  for (const nota of c.notas) {
    const conteudo = c.conteudos.get(nota.caminho) ?? "";
    const tituloNorm = normalizar(nota.titulo);
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
      score,
      trecho: montarTrecho(conteudo, termos),
    });
  }

  resultados.sort((a, b) => b.score - a.score);

  const aviso = c.truncado
    ? "O repositório é grande demais e a listagem de arquivos veio incompleta."
    : c.notas.length > MAX_NOTES_INDEXADAS
      ? `O vault tem ${c.notas.length} notas; a busca por conteúdo cobriu as primeiras ${MAX_NOTES_INDEXADAS}.`
      : undefined;

  return { resultados: resultados.slice(0, limite), aviso };
}

/** Baixa conteúdos em paralelo, respeitando um limite de requisições simultâneas. */
async function carregarEmLote(notas: Nota[]): Promise<void> {
  const c = await getCache();
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

export type ResultadoEscrita = {
  caminho: string;
  criada: boolean;
  commitUrl: string;
};

/**
 * Cria uma nota nova. Falha se já existir — sobrescrever por acidente
 * uma nota de estudo seria pior do que exigir um passo a mais.
 */
export async function criarNota(
  caminho: string,
  conteudo: string,
): Promise<ResultadoEscrita> {
  const cfg = getGitHubConfig();
  const caminhoFinal = normalizarCaminhoDeEscrita(caminho);
  const caminhoRepo = paraCaminhoRepo(caminhoFinal, cfg);

  const shaExistente = await getFileSha(cfg, caminhoRepo);
  if (shaExistente) {
    throw new Error(
      `A nota "${caminhoFinal}" já existe. Use editar_nota para alterá-la.`,
    );
  }

  const { commitUrl } = await putFile(cfg, {
    path: caminhoRepo,
    content: conteudo,
    message: `Cria nota: ${caminhoFinal}`,
  });

  invalidarCache();
  return { caminho: caminhoFinal, criada: true, commitUrl };
}

/**
 * Edita uma nota existente, substituindo o conteúdo ou acrescentando ao final.
 */
export async function editarNota(
  entrada: string,
  conteudo: string,
  modo: "substituir" | "acrescentar",
): Promise<ResultadoEscrita> {
  const cfg = getGitHubConfig();
  const nota = await resolverNota(entrada);
  if (!nota) {
    throw new Error(
      `Não encontrei a nota "${entrada}". Use buscar_notas ou listar_notas para achar o caminho certo.`,
    );
  }

  const caminhoRepo = paraCaminhoRepo(nota.caminho, cfg);

  // Relê o sha da API em vez de usar o do cache: o cache pode estar velho,
  // e um sha velho faria o GitHub rejeitar o commit.
  const sha = await getFileSha(cfg, caminhoRepo);
  if (!sha) {
    throw new Error(`A nota "${nota.caminho}" sumiu do repositório.`);
  }

  let conteudoFinal = conteudo;
  if (modo === "acrescentar") {
    const atual = await readBlob(cfg, sha);
    conteudoFinal = `${atual.replace(/\s*$/, "")}\n\n${conteudo}\n`;
  }

  const { commitUrl } = await putFile(cfg, {
    path: caminhoRepo,
    content: conteudoFinal,
    message: `Atualiza nota: ${nota.caminho}`,
    sha,
  });

  invalidarCache();
  return { caminho: nota.caminho, criada: false, commitUrl };
}

function normalizarCaminhoDeEscrita(caminho: string): string {
  const limpo = caminho
    .replace(/^\/+/, "")
    // ".." sairia da pasta do vault e escreveria em qualquer lugar do repo.
    .replace(/\.\.+/g, "")
    .trim();

  if (!limpo) throw new Error("O caminho da nota está vazio.");
  return limpo.toLowerCase().endsWith(".md") ? limpo : `${limpo}.md`;
}

/** Minúsculas e sem acentos — "Álgebra" e "algebra" precisam casar. */
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

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
