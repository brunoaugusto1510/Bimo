/**
 * O despachante central da extração — o único ponto que sabe "qual tipo MIME
 * vai pra qual extrator". Cada arquivo de extrator (`texto-puro.ts`, `pdf.ts`,
 * futuros `docx.ts`/`pptx.ts`/`pagina-web.ts`) se registra aqui sozinho ao ser
 * importado; adicionar um formato novo nunca exige tocar neste arquivo.
 */

import { ExtracaoNaoSuportadaError, type ExtratorDeTexto, type ParametrosExtracao, type ResultadoExtracao } from "./tipos";

const extratoresPorTipo = new Map<string, ExtratorDeTexto>();

/** Chamado por cada arquivo de extrator ao ser importado — registra para um ou mais tipos MIME. */
export function registrarExtrator(tipos: string[], extrator: ExtratorDeTexto): void {
  for (const tipo of tipos) extratoresPorTipo.set(tipo, extrator);
}

/** Mapeia extensões comuns pro tipo MIME canônico, usado quando o tipo não vem preenchido. */
const EXTENSOES_CONHECIDAS: Record<string, string> = {
  md: "text/markdown",
  markdown: "text/markdown",
  txt: "text/plain",
  pdf: "application/pdf",
};

function detectarTipo(tipoMime: string | null, nomeArquivoOriginal: string | null): string {
  if (tipoMime) return tipoMime;

  const extensao = nomeArquivoOriginal?.split(".").pop()?.toLowerCase();
  return (extensao && EXTENSOES_CONHECIDAS[extensao]) || "application/octet-stream";
}

/** Extrai o texto de um blob já em memória, dado seu tipo (ou nome de arquivo, se o tipo faltar). */
export async function extrairTexto(params: ParametrosExtracao): Promise<ResultadoExtracao> {
  const tipo = detectarTipo(params.tipoMime, params.nomeArquivoOriginal);
  const extrator = extratoresPorTipo.get(tipo);

  if (!extrator) {
    throw new ExtracaoNaoSuportadaError(tipo);
  }

  const texto = await extrator(params.conteudo);
  return { texto, tipoMime: tipo };
}
