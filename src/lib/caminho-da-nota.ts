/**
 * Título, pasta e caminho de uma nota — regras puras, as mesmas no servidor e
 * no cliente.
 *
 * Uma nota é identificada por um id opaco (ver `IdDeNota` em `types.ts`); o
 * "caminho" `Pasta/Título` é só rótulo de exibição e de ligação `[[...]]`.
 * A pasta é organização pura: não existe tabela de pastas, e uma pasta vazia
 * simplesmente não existe.
 */

/** Minúsculas e sem acentos — "Álgebra" e "algebra" precisam casar. */
export function normalizarTexto(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/**
 * Extensões de anexo que o Obsidian embute com `![[...]]`. O Bimo só guarda
 * notas de texto, então um link para um desses arquivos não resolve — mas não
 * é link quebrado, e não deve virar "não resolvida". Um título assim também é
 * recusado: nenhuma ligação chegaria a ele.
 */
export const REGEX_DE_ANEXO =
  /\.(png|jpe?g|gif|bmp|svg|webp|avif|heic|mp3|wav|m4a|ogg|flac|3gp|mp4|webm|ogv|mov|mkv|pdf|canvas|base|excalidraw)$/i;

export const TAMANHO_MAXIMO_DO_TITULO = 200;

/**
 * Caracteres que quebrariam uma ligação `[[...]]` (`[ ] # ^ |`) ou o caminho
 * `Pasta/Título` (`/ \`), mais os de controle.
 */
const CARACTERES_PROIBIDOS = /[/\\[\]#^|\u0000-\u001f\u007f]/;

export type ResultadoDeTitulo = { ok: true; titulo: string } | { ok: false; motivo: string };

export function validarTitulo(titulo: string): ResultadoDeTitulo {
  const limpo = titulo.trim();

  if (limpo === "") return { ok: false, motivo: "O título da nota não pode ficar vazio." };
  if (limpo.length > TAMANHO_MAXIMO_DO_TITULO) {
    return { ok: false, motivo: `O título pode ter no máximo ${TAMANHO_MAXIMO_DO_TITULO} caracteres.` };
  }
  if (CARACTERES_PROIBIDOS.test(limpo)) {
    return { ok: false, motivo: "O título não pode conter / \\ [ ] # ^ | nem quebras de linha." };
  }
  // `[[Receita.md]]` perde o `.md` e `[[Foto.png]]` é tratado como anexo: com esses títulos a nota ficaria inalcançável por ligação.
  if (/\.md$/i.test(limpo) || REGEX_DE_ANEXO.test(limpo)) {
    return { ok: false, motivo: "O título não pode terminar em .md nem em uma extensão de arquivo, como .png ou .pdf." };
  }
  return { ok: true, titulo: limpo };
}

/**
 * Arruma o texto de uma pasta: segmentos aparados, sem barras nas pontas ou
 * duplicadas, sem `.`/`..`. `null` é a raiz.
 */
export function normalizarPasta(pasta: string | null | undefined): string | null {
  if (!pasta) return null;

  const segmentos = pasta
    .replace(/\\/g, "/")
    .split("/")
    .map((segmento) => segmento.trim())
    .filter((segmento) => segmento !== "" && segmento !== "." && segmento !== "..");

  return segmentos.length === 0 ? null : segmentos.join("/");
}

/**
 * "projetos" e "Projetos" são a mesma pasta para a pessoa: se já existe uma
 * com outra caixa, a nova nota entra nela em vez de criar uma irmã. Vale por
 * segmento, então `projetos/api` vira `Projetos/api` se só `Projetos` existe.
 */
export function adotarGrafiaDaPasta(pasta: string | null, existentes: Iterable<string | null>): string | null {
  if (pasta === null) return null;

  // Cada prefixo de cada pasta existente, pela forma minúscula.
  const grafias = new Map<string, string>();
  for (const existente of existentes) {
    let prefixo = "";
    for (const segmento of existente ? existente.split("/") : []) {
      prefixo = prefixo ? `${prefixo}/${segmento}` : segmento;
      if (!grafias.has(prefixo.toLowerCase())) grafias.set(prefixo.toLowerCase(), prefixo);
    }
  }

  let pedido = "";
  let resultado = "";
  for (const segmento of pasta.split("/")) {
    pedido = pedido ? `${pedido}/${segmento}` : segmento;
    resultado = grafias.get(pedido.toLowerCase()) ?? (resultado ? `${resultado}/${segmento}` : segmento);
  }
  return resultado;
}

/** `Faculdade/Redes/TCP.md` -> pasta `Faculdade/Redes`, título `TCP`. */
export function dividirCaminho(caminho: string): { pasta: string | null; titulo: string } {
  const partes = caminho.split("/");
  const arquivo = partes.pop() ?? "";

  return { pasta: normalizarPasta(partes.join("/")), titulo: arquivo.replace(/\.md$/i, "") };
}

/** Inverso de `dividirCaminho`, sem a extensão: o formato que `[[Pasta/Título]]` usa. */
export function juntarCaminho(pasta: string | null, titulo: string): string {
  return pasta ? `${pasta}/${titulo}` : titulo;
}

/** Referência exata para a raiz ou para caminhos com delimitadores de wikilink. Preserva pastas já existentes. */
export function caminhoParaLigacao(pasta: string | null, titulo: string): string {
  const caminho = juntarCaminho(pasta, titulo);
  return !pasta || /[%[\]#^|\r\n]/.test(caminho) ? `/${escaparCaminhoDaLigacao(caminho)}` : caminho;
}
export const escaparCaminhoDaLigacao = (caminho: string) => caminho.replace(/[%[\]#^|\r\n]/g, (c) => encodeURIComponent(c));

/** Cor e agrupamento no grafo: a pasta de topo, ou "Raiz" para notas soltas. */
export function grupoDaPasta(pasta: string | null): string {
  if (!pasta) return "Raiz";
  const primeiraBarra = pasta.indexOf("/");
  return primeiraBarra === -1 ? pasta : pasta.slice(0, primeiraBarra);
}

export function profundidadeDaPasta(pasta: string | null): number {
  return pasta ? pasta.split("/").length : 0;
}
