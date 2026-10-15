/**
 * Constrói o grafo de ligações entre notas, no estilo do "graph view" do
 * Obsidian: cada nota é um nó, e cada link `[[assim]]` dentro dela vira uma
 * ligação até a nota citada. Como no Obsidian, links para notas que ainda não
 * existem viram nós "não resolvidos" e, se o vault pedir, tags viram nós.
 *
 * Diferente da árvore de pastas (que só precisa dos caminhos), montar o grafo
 * exige baixar o *conteúdo* de cada nota para achar os links — por isso baixa
 * em lote, com um limite de quantas notas ficam de fora de vaults enormes.
 *
 * O que entra no grafo e como ele se move vem do `.obsidian/graph.json` do
 * próprio vault (ver `fisica-do-grafo.ts`).
 */

import {
  CONFIGURACAO_PADRAO,
  calcularGraus,
  lerConfiguracaoDoGrafo,
  type ConfiguracaoDoGrafo,
} from "./fisica-do-grafo";
import { getGitHubConfig, readBlob, readFile } from "./github";
import { obterNotasPlanas, type NotaPlana } from "./vault-real";

const CACHE_TTL_MS = 5 * 60 * 1000;
/** Teto de notas cujo conteúdo baixamos para achar links — protege vaults enormes. */
const MAX_NOTAS_NO_GRAFO = 800;
/** Quantos downloads de nota rodam ao mesmo tempo. */
const CONCORRENCIA = 8;
/** Onde o Obsidian guarda as opções do grafo, relativo à raiz do vault. */
const CAMINHO_DA_CONFIGURACAO = ".obsidian/graph.json";

/**
 * Um nó do grafo. O `id` é o que as arestas referenciam: o caminho da nota,
 * ou um id com prefixo para os nós que não são arquivos. Os prefixos nunca
 * colidem com uma nota — caminho de nota sempre termina em `.md`.
 */
export type NoDoGrafo =
  | { tipo: "nota"; id: string; titulo: string; grupo: string }
  | { tipo: "nao-resolvida"; id: string; titulo: string }
  | { tipo: "tag"; id: string; titulo: string };

export type ArestaDoGrafo = { de: string; para: string };

/**
 * Grupo de uma nota, usado para colorir o grafo — o primeiro segmento do
 * caminho (a pasta de topo). Notas soltas na raiz do vault caem no grupo
 * "Raiz".
 */
export function obterGrupoDoCaminho(caminho: string): string {
  const primeiraBarra = caminho.indexOf("/");
  return primeiraBarra === -1 ? "Raiz" : caminho.slice(0, primeiraBarra);
}

export type Grafo = {
  nos: NoDoGrafo[];
  arestas: ArestaDoGrafo[];
  /** Vai junto para o cliente: é dela que o `GrafoDeFundo` tira a física. */
  configuracao: ConfiguracaoDoGrafo;
  aviso?: string;
};

type Cache = { carregadoEm: number; grafo: Grafo };
let cache: Cache | null = null;

/**
 * Descarta o cache do grafo. Chamado por `ferramentas.ts` depois de toda
 * escrita no vault (criar/editar nota) — sem isso o grafo de fundo continuaria
 * mostrando a versão antiga por até `CACHE_TTL_MS`.
 *
 * Fica aqui (e não em `vault-real.ts`) para não criar um import circular:
 * este módulo já depende de `vault-real.ts`, então é `ferramentas.ts` — que
 * fica acima dos dois — quem invalida os dois caches depois de escrever.
 */
export function invalidarCacheDoGrafo(): void {
  cache = null;
}

/** Minúsculas e sem acentos — "Álgebra" e "algebra" precisam casar. */
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/**
 * Acha todos os links `[[Nome da Nota]]` num texto.
 *
 * O Obsidian aceita variações no que vem depois do nome: `[[Nota#Título]]`
 * (link para uma seção), `[[Nota^bloco]]` (link para um bloco) e
 * `[[Nota|texto exibido]]` (apelido). Para o grafo, todas apontam para a
 * mesma nota — então cortamos tudo isso e ficamos só com o nome.
 */
function extrairNomesLinkados(conteudo: string): string[] {
  const nomes: string[] = [];
  const regex = /\[\[([^\]|#^]+)/g;
  let combinou: RegExpExecArray | null;

  while ((combinou = regex.exec(conteudo)) !== null) {
    const nome = combinou[1].trim();
    if (nome) nomes.push(nome);
  }

  return nomes;
}

/**
 * O miolo é opcional e preguiçoso (`??`): o frontmatter vazio é tentado
 * primeiro. Com um `?` comum, um `---`/`---` vazio casaria até a próxima
 * linha horizontal do texto, engolindo o corpo.
 */
const REGEX_FRONTMATTER = /^---\r?\n(?:([\s\S]*?)\r?\n)??---(?:\r?\n|$)/;
/**
 * Extensões de anexo que o Obsidian embute com `![[...]]`. O Bimo só
 * enxerga as notas `.md` do vault, então um link para um desses arquivos não
 * resolve — mas não é link quebrado, e não deve virar nó "não resolvido".
 */
const REGEX_ANEXO =
  /\.(png|jpe?g|gif|bmp|svg|webp|avif|heic|mp3|wav|m4a|ogg|flac|3gp|mp4|webm|ogv|mov|mkv|pdf|canvas|base|excalidraw)$/i;
/** Tag no corpo: `#` colado no nome, logo depois de um espaço ou do começo da linha. */
const REGEX_TAG_NO_TEXTO = /(^|\s)#([\p{L}\p{N}_\-/]+)/gu;

/** Só dígitos não é tag para o Obsidian — `#123` costuma ser número de issue. */
function ehTagValida(tag: string): boolean {
  return /[^\d/]/.test(tag);
}

/** Tags do campo `tags:` (ou `tag:`) do frontmatter, nas três formas que o YAML do Obsidian aceita. */
function extrairTagsDoFrontmatter(frontmatter: string): string[] {
  const linhas = frontmatter.split(/\r?\n/);
  const indice = linhas.findIndex((linha) => /^tags?\s*:/i.test(linha));
  if (indice === -1) return [];

  const valor = linhas[indice].replace(/^tags?\s*:/i, "").trim();
  const itens: string[] = [];

  if (valor) {
    // `tags: [a, b]` ou `tags: a, b` ou `tags: a b`.
    itens.push(...valor.replace(/^\[|\]$/g, "").split(/[,\s]+/));
  } else {
    // Lista de blocos: cada `- item` nas linhas seguintes, até a primeira que não for item.
    for (const linha of linhas.slice(indice + 1)) {
      const item = linha.match(/^\s*-\s*(.+)$/);
      if (!item) break;
      itens.push(item[1]);
    }
  }

  return itens
    .map((item) => item.trim().replace(/^["']|["']$/g, "").replace(/^#/, ""))
    .filter((tag) => tag && ehTagValida(tag));
}

/**
 * Acha as tags de uma nota (sem o `#`), na ordem em que aparecem e sem
 * repetir — duas grafias que só diferem em maiúsculas contam como uma.
 * Código (em bloco ou em linha) fica de fora: `#include` num trecho de C
 * não é tag.
 */
export function extrairTags(conteudo: string): string[] {
  const frontmatter = conteudo.match(REGEX_FRONTMATTER);
  const corpo = (frontmatter ? conteudo.slice(frontmatter[0].length) : conteudo)
    .replace(/(```|~~~)[\s\S]*?\1/g, "")
    .replace(/`[^`\n]*`/g, "");

  const encontradas = frontmatter?.[1] ? extrairTagsDoFrontmatter(frontmatter[1]) : [];
  for (const combinou of corpo.matchAll(REGEX_TAG_NO_TEXTO)) {
    if (ehTagValida(combinou[2])) encontradas.push(combinou[2]);
  }

  const vistas = new Set<string>();
  return encontradas.filter((tag) => {
    const chave = tag.toLowerCase();
    if (vistas.has(chave)) return false;
    vistas.add(chave);
    return true;
  });
}

/** Acha a nota cujo nome ou caminho bate com o texto do link. `undefined` se nenhuma existir (link quebrado). */
function resolverLink(nomeLinkado: string, notas: NotaPlana[]): NotaPlana | undefined {
  const alvo = normalizar(nomeLinkado.replace(/\.md$/i, ""));
  const semExtensao = (caminho: string) => normalizar(caminho.replace(/\.md$/i, ""));
  const titulo = (caminho: string) => normalizar(caminho.split("/").pop()!.replace(/\.md$/i, ""));

  return (
    notas.find((n) => semExtensao(n.caminho) === alvo) ??
    notas.find((n) => titulo(n.caminho) === alvo) ??
    notas.find((n) => semExtensao(n.caminho).endsWith(`/${alvo}`))
  );
}

function tituloDoCaminho(caminho: string): string {
  return caminho.split("/").pop()!.replace(/\.md$/i, "");
}

/**
 * Monta nós e arestas a partir das notas e do conteúdo já baixado. Pura —
 * toda a parte de rede fica em `obterGrafoDoVault`.
 *
 * Notas sem conteúdo no mapa (as que passaram do `MAX_NOTAS_NO_GRAFO`)
 * entram como nós, mas sem links próprios.
 */
export function montarGrafo({
  notas,
  conteudos,
  configuracao,
}: {
  notas: NotaPlana[];
  conteudos: Map<string, string>;
  configuracao: ConfiguracaoDoGrafo;
}): Grafo {
  const nosPorId = new Map<string, NoDoGrafo>(
    notas.map((n) => [
      n.caminho,
      { tipo: "nota", id: n.caminho, titulo: tituloDoCaminho(n.caminho), grupo: obterGrupoDoCaminho(n.caminho) },
    ]),
  );

  const arestas: ArestaDoGrafo[] = [];
  // Cada par conta uma única vez. Sem isso o mesmo par entra várias vezes —
  // uma nota pode citar `[[X]]` em vários trechos, e `A -> B` mais `B -> A`
  // desenham a mesma linha. Duplicatas distorcem o grafo duas vezes:
  // multiplicam a força do link naquele par na simulação e inflam o "grau",
  // que é o que define o tamanho da bolinha (criando hubs que não existem).
  const paresJaVistos = new Set<string>();

  function ligar(de: string, para: string) {
    if (de === para) return;
    // Par ordenado alfabeticamente, então `A -> B` e `B -> A` geram a mesma
    // chave. O `\n` separa os dois ids sem ambiguidade: nenhum contém uma
    // quebra de linha.
    const chave = [de, para].sort().join("\n");
    if (paresJaVistos.has(chave)) return;
    paresJaVistos.add(chave);
    arestas.push({ de, para });
  }

  function garantirNo(no: NoDoGrafo) {
    if (!nosPorId.has(no.id)) nosPorId.set(no.id, no);
  }

  for (const nota of notas) {
    const conteudo = conteudos.get(nota.caminho);
    if (conteudo === undefined) continue;

    for (const nomeLinkado of extrairNomesLinkados(conteudo)) {
      const alvo = resolverLink(nomeLinkado, notas);
      if (alvo) {
        ligar(nota.caminho, alvo.caminho);
        continue;
      }
      if (configuracao.hideUnresolved || REGEX_ANEXO.test(nomeLinkado)) continue;

      const semExtensao = nomeLinkado.replace(/\.md$/i, "");
      const id = `nao-resolvida:${normalizar(semExtensao)}`;
      garantirNo({ tipo: "nao-resolvida", id, titulo: tituloDoCaminho(semExtensao) });
      ligar(nota.caminho, id);
    }

    if (configuracao.showTags) {
      for (const tag of extrairTags(conteudo)) {
        const id = `tag:${tag.toLowerCase()}`;
        garantirNo({ tipo: "tag", id, titulo: `#${tag}` });
        ligar(nota.caminho, id);
      }
    }
  }

  let nos = [...nosPorId.values()];
  if (!configuracao.showOrphans) {
    const graus = calcularGraus(arestas);
    nos = nos.filter((no) => graus.has(no.id));
  }

  return { nos, arestas, configuracao };
}

/** Baixa o conteúdo de várias notas ao mesmo tempo, limitado a `CONCORRENCIA` por vez. */
async function baixarConteudos(notas: NotaPlana[]): Promise<Map<string, string>> {
  const cfg = getGitHubConfig();
  const conteudos = new Map<string, string>();
  const fila = [...notas];

  const trabalhadores = Array.from({ length: Math.min(CONCORRENCIA, fila.length) }, async () => {
    while (fila.length > 0) {
      const nota = fila.shift();
      if (!nota) return;
      try {
        conteudos.set(nota.caminho, await readBlob(cfg, nota.sha));
      } catch {
        // Uma nota que falhou ao baixar não pode derrubar o grafo inteiro.
        conteudos.set(nota.caminho, "");
      }
    }
  });

  await Promise.all(trabalhadores);
  return conteudos;
}

/**
 * Lê o `.obsidian/graph.json` do vault — que fica na raiz do vault, ou seja,
 * em `VAULT_SUBPATH` quando ele está definido. Qualquer problema — arquivo fora do
 * repositório (muita gente põe `.obsidian/` no `.gitignore`), JSON quebrado,
 * falha de rede — cai nos padrões do Obsidian: é só aparência, e não vale
 * derrubar o grafo por ela. Erro de configuração do GitHub também cai aqui,
 * mas não se perde: `obterNotasPlanas`, que roda junto, falha com ele.
 */
async function lerConfiguracaoDoVault(): Promise<ConfiguracaoDoGrafo> {
  try {
    const cfg = getGitHubConfig();
    const caminho = cfg.subpath ? `${cfg.subpath}/${CAMINHO_DA_CONFIGURACAO}` : CAMINHO_DA_CONFIGURACAO;
    const texto = await readFile(cfg, caminho);
    return texto === null ? CONFIGURACAO_PADRAO : lerConfiguracaoDoGrafo(JSON.parse(texto));
  } catch {
    return CONFIGURACAO_PADRAO;
  }
}

/** Monta o grafo do vault inteiro, usando o cache quando possível. */
export async function obterGrafoDoVault(): Promise<Grafo> {
  if (cache && Date.now() - cache.carregadoEm < CACHE_TTL_MS) {
    return cache.grafo;
  }

  const [{ notas, aviso: avisoDaListagem }, configuracao] = await Promise.all([
    obterNotasPlanas(),
    lerConfiguracaoDoVault(),
  ]);

  const conteudos = await baixarConteudos(notas.slice(0, MAX_NOTAS_NO_GRAFO));

  const avisoDeCorte =
    notas.length > MAX_NOTAS_NO_GRAFO
      ? `Há ${notas.length} notas; os links foram lidos só nas primeiras ${MAX_NOTAS_NO_GRAFO}.`
      : undefined;

  const grafo: Grafo = {
    ...montarGrafo({ notas, conteudos, configuracao }),
    aviso: avisoDaListagem ?? avisoDeCorte,
  };
  cache = { carregadoEm: Date.now(), grafo };
  return grafo;
}
