/**
 * Funções puras sobre o texto Markdown de uma nota: frontmatter, tags,
 * títulos (a "estrutura" do painel lateral), contagem de palavras e trechos.
 *
 * Rodam no servidor (índice de ligações, grafo) e no cliente (a estrutura e as
 * contagens da barra de status são calculadas ao vivo, enquanto se digita).
 */

/**
 * O miolo é opcional e preguiçoso (`??`): o frontmatter vazio é tentado
 * primeiro. Com um `?` comum, um `---`/`---` vazio casaria até a próxima
 * linha horizontal do texto, engolindo o corpo.
 */
const REGEX_FRONTMATTER = /^---\r?\n(?:([\s\S]*?)\r?\n)??---(?:\r?\n|$)/;
/** Tag no corpo: `#` colado no nome, logo depois de um espaço ou do começo da linha. */
const REGEX_TAG_NO_TEXTO = /(^|\s)#([\p{L}\p{N}_\-/]+)/gu;
/** Começo de um título ATX: de 1 a 6 `#` e um espaço. */
const REGEX_COMECO_DE_TITULO = /^(#{1,6})[ \t]/;

/**
 * O texto de um título, sem os espaços das pontas e sem os `#` de fechamento (que só
 * valem depois de um espaço: `# C#` é o título "C#"). Sem regex com `.*?` + `$`, que
 * refaz o caminho a cada espaço de uma linha longa.
 */
function textoDoTitulo(linha: string, nivel: number): string {
  let texto = linha.slice(nivel).trim();

  let fim = texto.length;
  while (fim > 0 && texto[fim - 1] === "#") fim--;
  if (fim < texto.length && fim > 0 && /[ \t]/.test(texto[fim - 1])) texto = texto.slice(0, fim).trimEnd();

  return texto;
}

export type TextoSeparado = {
  /** O YAML sem as cercas `---`, ou `null` se não há (ou se está vazio). */
  frontmatter: string | null;
  corpo: string;
  /** Posição, no texto original, onde o corpo começa. */
  inicioDoCorpo: number;
};

export function separarFrontmatter(conteudo: string): TextoSeparado {
  const combinou = conteudo.match(REGEX_FRONTMATTER);
  if (!combinou) return { frontmatter: null, corpo: conteudo, inicioDoCorpo: 0 };

  return {
    frontmatter: combinou[1] ?? null,
    corpo: conteudo.slice(combinou[0].length),
    inicioDoCorpo: combinou[0].length,
  };
}

/**
 * Troca blocos e trechos de código por espaços. O tamanho e as quebras de
 * linha ficam como estavam, então as posições no texto mascarado valem no
 * original — é assim que ligações e títulos ignoram código sem perder o lugar.
 */
export function mascararCodigo(texto: string): string {
  const apagar = (trecho: string) => trecho.replace(/[^\n]/g, " ");
  return mascararCercas(texto, apagar).replace(/`[^`\n]*`/g, apagar);
}

/**
 * Blocos cercados como o CommonMark os lê: a cerca abre numa linha própria (até 3
 * espaços de recuo), fecha numa linha só de cerca do mesmo caractere e de tamanho igual
 * ou maior — então ```` contém ``` por dentro — e uma cerca que nunca fecha vai até o fim.
 */
function mascararCercas(texto: string, apagar: (trecho: string) => string): string {
  let aberta: { caractere: string; tamanho: number } | null = null;

  return texto
    .split("\n")
    .map((linha) => {
      if (aberta) {
        const fecho = linha.match(/^ {0,3}(`{3,}|~{3,})[ \t\r]*$/);
        if (fecho && fecho[1][0] === aberta.caractere && fecho[1].length >= aberta.tamanho) aberta = null;
        return apagar(linha);
      }

      const abertura = linha.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
      // Numa cerca de crases a descrição não pode ter crases (senão é código em linha).
      if (abertura && !(abertura[1][0] === "`" && abertura[2].includes("`"))) {
        aberta = { caractere: abertura[1][0], tamanho: abertura[1].length };
        return apagar(linha);
      }
      return linha;
    })
    .join("\n");
}

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
  const { frontmatter, corpo } = separarFrontmatter(conteudo);
  const encontradas = frontmatter ? extrairTagsDoFrontmatter(frontmatter) : [];

  for (const combinou of mascararCodigo(corpo).matchAll(REGEX_TAG_NO_TEXTO)) {
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

export type TituloDoTexto = {
  nivel: number;
  texto: string;
  /** Linha no texto inteiro, a partir de 1 — é por ela que a "estrutura" rola até o título. */
  linha: number;
};

/** Os títulos `#`…`######` do corpo, fora de código e do frontmatter. */
export function extrairTitulos(conteudo: string): TituloDoTexto[] {
  const { inicioDoCorpo } = separarFrontmatter(conteudo);
  const primeiraLinhaDoCorpo = conteudo.slice(0, inicioDoCorpo).split("\n").length - 1;

  const originais = conteudo.split("\n");
  const mascaradas = mascararCodigo(conteudo).split("\n");
  const titulos: TituloDoTexto[] = [];

  for (let i = primeiraLinhaDoCorpo; i < originais.length; i++) {
    // Decide pela linha mascarada (código não vira título) e lê o texto da original.
    const comeco = mascaradas[i].match(REGEX_COMECO_DE_TITULO);
    if (!comeco) continue;

    const nivel = comeco[1].length;
    const texto = textoDoTitulo(originais[i], nivel);
    if (texto !== "") titulos.push({ nivel, texto, linha: i + 1 });
  }

  return titulos;
}

/** Palavras do corpo — símbolos soltos como "—" não contam. */
export function contarPalavras(conteudo: string): number {
  const { corpo } = separarFrontmatter(conteudo);
  return corpo.split(/\s+/).filter((pedaco) => /[\p{L}\p{N}]/u.test(pedaco)).length;
}

/** Texto em volta de uma posição, numa linha só e com reticências onde foi cortado. */
export function trechoAoRedor(texto: string, indice: number, raio = 80): string {
  const inicio = Math.max(0, indice - raio);
  const fim = Math.min(texto.length, indice + raio);
  const trecho = texto.slice(inicio, fim).replace(/\s+/g, " ").trim();

  return `${inicio > 0 ? "…" : ""}${trecho}${fim < texto.length ? "…" : ""}`;
}
