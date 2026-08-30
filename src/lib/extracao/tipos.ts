/**
 * Tipos compartilhados por todo o subsistema de extração (Fase 3: Sources &
 * Ingestion). Um extrator concreto (`texto-puro.ts`, `pdf.ts`, e no futuro
 * `docx.ts`, `pptx.ts`, `pagina-web.ts`...) só precisa conhecer estes tipos e
 * `registrarExtrator` (ver `registro.ts`) — nunca o despachante em si.
 */

export type ResultadoExtracao = {
  texto: string;
  /** Tipo MIME efetivamente usado — pode ter sido inferido pelo nome do arquivo. */
  tipoMime: string;
};

export type ParametrosExtracao = {
  conteudo: Buffer;
  tipoMime: string | null;
  nomeArquivoOriginal: string | null;
};

/** Um extrator recebe os bytes já resolvidos para um tipo conhecido e devolve o texto puro. */
export type ExtratorDeTexto = (conteudo: Buffer) => Promise<string>;

export class ExtracaoNaoSuportadaError extends Error {
  constructor(readonly tipoMime: string) {
    super(`Extração de texto não suportada para o tipo "${tipoMime}" ainda.`);
    this.name = "ExtracaoNaoSuportadaError";
  }
}
