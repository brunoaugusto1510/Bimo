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

export function detectarGatilho(texto: string, cursor: number): Gatilho | null {
  if (!texto || !Number.isInteger(cursor) || cursor < 2 || cursor > texto.length) return null;

  // Os testes baratos (só a linha do cursor) vêm antes do que olha o texto inteiro: isto roda a cada tecla.
  const inicioDaLinha = Math.max(texto.lastIndexOf("\n", cursor - 1), texto.lastIndexOf("\r", cursor - 1)) + 1;
  const inicio = texto.lastIndexOf("[[", cursor - 2);
  if (inicio < inicioDaLinha) return null;
  const consulta = texto.slice(inicio + 2, cursor);
  if (/[\[\]|\r\n]/.test(consulta)) return null;
  // Cursor no meio de uma ligação que já existe (`[[Mi|nha nota]]`, `[[Nota|apelido]]`): não é digitação de
  // uma ligação nova, e inserir ali deixaria o resto da antiga para trás.
  const seguinte = texto[cursor];
  if (seguinte !== undefined && !/[\s\]]/.test(seguinte)) return null;

  let barras = 0;
  for (let i = inicio - 1; i >= 0 && texto[i] === "\\"; i--) barras++;
  if (barras % 2 !== 0) return null;

  const { corpo, inicioDoCorpo } = separarFrontmatter(texto);
  if (cursor < inicioDoCorpo) return null;
  // O frontmatter sem fechamento ainda está sendo escrito.
  if (inicioDoCorpo === 0 && /^---\r?\n/.test(texto)) return null;

  const mascarado = mascararCodigo(corpo);
  if (mascarado.slice(inicio - inicioDoCorpo, cursor - inicioDoCorpo) !== texto.slice(inicio, cursor)) return null;
  if (dentroDeCodigoEmLinha(texto.slice(inicioDaLinha, cursor))) return null;

  return { tipo: "ligacao", inicio, consulta };
}
