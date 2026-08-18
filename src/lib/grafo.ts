/**
 * Constrói o grafo de ligações entre notas, no estilo "grafo local" do
 * Obsidian: cada nota é um nó, e cada link `[[assim]]` dentro dela vira uma
 * ligação até a nota citada.
 *
 * Diferente da árvore de pastas (que só precisa dos caminhos), montar o grafo
 * exige baixar o *conteúdo* de cada nota para achar os links — por isso baixa
 * em lote, com um limite de quantas notas ficam de fora de vaults enormes.
 */

import { getGitHubConfig, readBlob } from "./github";
import { obterNotasPlanas, type NotaPlana } from "./vault-real";

const CACHE_TTL_MS = 5 * 60 * 1000;
/** Teto de notas cujo conteúdo baixamos para achar links — protege vaults enormes. */
const MAX_NOTAS_NO_GRAFO = 800;
/** Quantos downloads de nota rodam ao mesmo tempo. */
const CONCORRENCIA = 8;

export type NoDoGrafo = { caminho: string; titulo: string; grupo: string };
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

/** Monta o grafo do vault inteiro, usando o cache quando possível. */
export async function obterGrafoDoVault(): Promise<Grafo> {
  if (cache && Date.now() - cache.carregadoEm < CACHE_TTL_MS) {
    return cache.grafo;
  }

  const { notas, aviso: avisoDaListagem } = await obterNotasPlanas();

  const notasNoGrafo = notas.slice(0, MAX_NOTAS_NO_GRAFO);
  const conteudos = await baixarConteudos(notasNoGrafo);

  const arestas: ArestaDoGrafo[] = [];
  // Cada par de notas conta uma única vez. Sem isso o mesmo par entra várias
  // vezes — uma nota pode citar `[[X]]` em vários trechos, e `A -> B` mais
  // `B -> A` desenham a mesma linha. Duplicatas distorcem o grafo duas vezes:
  // multiplicam a força do link naquele par na simulação e inflam o "grau",
  // que é o que define o tamanho da bolinha (criando hubs que não existem).
  const paresJaVistos = new Set<string>();

  for (const nota of notasNoGrafo) {
    const conteudo = conteudos.get(nota.caminho) ?? "";
    for (const nomeLinkado of extrairNomesLinkados(conteudo)) {
      const alvo = resolverLink(nomeLinkado, notas);
      // Ignora links quebrados (apontam para uma nota que não existe) e auto-links.
      if (!alvo || alvo.caminho === nota.caminho) continue;

      // Par ordenado alfabeticamente, então `A -> B` e `B -> A` geram a mesma
      // chave. O `\n` separa os dois caminhos sem ambiguidade: nenhum caminho
      // de arquivo contém uma quebra de linha.
      const chave = [nota.caminho, alvo.caminho].sort().join("\n");
      if (paresJaVistos.has(chave)) continue;
      paresJaVistos.add(chave);

      arestas.push({ de: nota.caminho, para: alvo.caminho });
    }
  }

  const nos: NoDoGrafo[] = notas.map((n) => ({
    caminho: n.caminho,
    titulo: n.caminho.split("/").pop()!.replace(/\.md$/i, ""),
    grupo: obterGrupoDoCaminho(n.caminho),
  }));

  const avisoDeCorte =
    notas.length > MAX_NOTAS_NO_GRAFO
      ? `O vault tem ${notas.length} notas; os links foram lidos só nas primeiras ${MAX_NOTAS_NO_GRAFO}.`
      : undefined;

  const grafo: Grafo = { nos, arestas, aviso: avisoDaListagem ?? avisoDeCorte };
  cache = { carregadoEm: Date.now(), grafo };
  return grafo;
}
