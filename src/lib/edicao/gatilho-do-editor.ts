import { mascararCodigo, separarFrontmatter } from "../markdown-da-nota";

export type Gatilho =
  | { tipo: "ligacao"; inicio: number; consulta: string }
  | { tipo: "tag"; inicio: number; consulta: string }
  | { tipo: "comando"; inicio: number; consulta: string };

/** Inclui o trecho em linha ainda aberto enquanto a pessoa digita. */
function dentroDeCodigoEmLinha(linha: string): boolean {
  let cerca = 0;
  for (let i = 0; i < linha.length; i++) {
    if (!cerca && linha[i] === "\\") {
      i++;
      continue;
    }
    if (linha[i] !== "`") continue;
    let fim = i + 1;
    while (linha[fim] === "`") fim++;
    const tamanho = fim - i;
    if (!cerca) cerca = tamanho;
    else if (tamanho === cerca) cerca = 0;
    i = fim - 1;
  }
  return cerca !== 0;
}

type Candidato = { tipo: Gatilho["tipo"]; inicio: number; consulta: string };

/** `[[consulta` aberto na linha do cursor (e ainda não fechado nem com `|`/`]`). */
function candidatoDeLigacao(texto: string, cursor: number, inicioDaLinha: number): Candidato | null {
  if (cursor < 2) return null;
  const inicio = texto.lastIndexOf("[[", cursor - 2);
  if (inicio < inicioDaLinha) return null;
  const consulta = texto.slice(inicio + 2, cursor);
  if (/[\[\]|\r\n]/.test(consulta)) return null;
  let barras = 0;
  for (let i = inicio - 1; i >= 0 && texto[i] === "\\"; i--) barras++;
  return barras % 2 === 0 ? { tipo: "ligacao", inicio, consulta } : null;
}

/** Há um `[[` na linha, antes do cursor, e nenhum `]]` depois dele. */
function ligacaoAindaAberta(texto: string, cursor: number, inicioDaLinha: number): boolean {
  const abertura = cursor < 2 ? -1 : texto.lastIndexOf("[[", cursor - 2);
  return abertura >= inicioDaLinha && !texto.slice(abertura, cursor).includes("]]");
}

/** `#tag` ou `/comando` no fim do trecho da linha antes do cursor, depois do começo da linha ou de um espaço. */
const TAG = /(^|\s)#([\p{L}\p{N}_\-/]+)$/u;
/** A barra sozinha só abre o menu no começo da linha (depois do recuo); no meio da frase ("Sim /", "e / ou") ela sequestraria as setas e o Enter. */
const COMANDO_NO_COMECO = /^([ \t]*)\/(\p{L}*)$/u;
const COMANDO_NO_MEIO = /(\s)\/(\p{L}+)$/u;

function candidatoDeMarcador(linhaAteOCursor: string, inicioDaLinha: number): Candidato | null {
  const tag = TAG.exec(linhaAteOCursor);
  // Número puro (`#123`, `a #1`) não é tag: é issue, página, item (a mesma regra de `ehTagValida`).
  if (tag && /[^\d/]/.test(tag[2])) return { tipo: "tag", inicio: inicioDaLinha + tag.index + tag[1].length, consulta: tag[2] };
  const comando = COMANDO_NO_COMECO.exec(linhaAteOCursor) ?? COMANDO_NO_MEIO.exec(linhaAteOCursor);
  if (comando) return { tipo: "comando", inicio: inicioDaLinha + comando.index + comando[1].length, consulta: comando[2] };
  return null;
}

/** Fora de frontmatter e de código (cercado ou em linha), olhando o trecho `[inicio, cursor)`. */
function foraDeCodigoEFrontmatter(texto: string, inicio: number, cursor: number, inicioDaLinha: number): boolean {
  const { corpo, inicioDoCorpo } = separarFrontmatter(texto);
  if (cursor < inicioDoCorpo) return false;
  // O frontmatter sem fechamento ainda está sendo escrito.
  if (inicioDoCorpo === 0 && /^---\r?\n/.test(texto)) return false;
  const mascarado = mascararCodigo(corpo);
  if (mascarado.slice(inicio - inicioDoCorpo, cursor - inicioDoCorpo) !== texto.slice(inicio, cursor)) return false;
  return !dentroDeCodigoEmLinha(texto.slice(inicioDaLinha, cursor));
}

/**
 * O que a pessoa está digitando no cursor que merece uma lista: `[[ligação`, `#tag` ou `/comando`.
 * Roda a cada tecla: os testes baratos (só a linha do cursor) vêm antes do que olha o texto inteiro.
 */
export function detectarGatilho(texto: string, cursor: number): Gatilho | null {
  if (!texto || !Number.isInteger(cursor) || cursor < 1 || cursor > texto.length) return null;

  const inicioDaLinha = Math.max(texto.lastIndexOf("\n", cursor - 1), texto.lastIndexOf("\r", cursor - 1)) + 1;
  // Uma `[[` aberta na linha vence: dentro dela o `#` separa a seção da nota, não começa uma tag.
  const ligacao = candidatoDeLigacao(texto, cursor, inicioDaLinha);
  // `[[Nota|apelido #x`: a ligação ainda está aberta (sem `]]`), então o `#` e a `/` do apelido não abrem tag nem comando.
  if (!ligacao && ligacaoAindaAberta(texto, cursor, inicioDaLinha)) return null;
  const candidato = ligacao ?? candidatoDeMarcador(texto.slice(inicioDaLinha, cursor), inicioDaLinha);
  if (!candidato) return null;

  // Cursor no meio de uma ligação, tag ou palavra que já existe (`[[Mi|nha nota]]`, `[[Nota|apelido]]`, `#ide|ia`): não é
  // digitação de uma nova, e inserir ali deixaria o resto da antiga para trás. Numa ligação o `]` seguinte (`[[re|]]`) é o fecho.
  const seguinte = texto[cursor];
  if (seguinte !== undefined && !(candidato.tipo === "ligacao" ? /[\s\]]/ : /\s/).test(seguinte)) return null;

  if (!foraDeCodigoEFrontmatter(texto, candidato.inicio, cursor, inicioDaLinha)) return null;
  return candidato;
}
