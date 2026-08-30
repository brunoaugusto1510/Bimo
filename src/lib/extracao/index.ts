/**
 * Fachada pública da extração de texto (Fase 3: Sources & Ingestion).
 *
 * Importar os extratores aqui (pelo efeito colateral de `registrarExtrator`)
 * é o que os liga ao despachante — adicionar um formato novo (docx, pptx,
 * página web) é só criar o arquivo e importar aqui, sem tocar em
 * `registro.ts` nem em quem consome `extrairTexto`/`extrairTextoDaFonte`.
 */
import "./texto-puro";
import "./pdf";
import "./pagina-web";

import { obterFonte } from "../fontes";
import { baixarArquivo, getConfigStorage } from "../supabase-storage";
import { extrairTexto } from "./registro";
import type { ResultadoExtracao } from "./tipos";

export { extrairTexto };
export { ExtracaoNaoSuportadaError } from "./tipos";
export type { ParametrosExtracao, ResultadoExtracao } from "./tipos";

/** Busca a Fonte, baixa o blob do Storage e extrai o texto — o atalho de ponta a ponta. */
export async function extrairTextoDaFonte(userId: string, fonteId: number): Promise<ResultadoExtracao> {
  const fonte = await obterFonte(userId, fonteId);
  if (!fonte) {
    throw new Error(`Fonte ${fonteId} não encontrada para este usuário.`);
  }

  const conteudo = await baixarArquivo(getConfigStorage(), fonte.caminhoArmazenamento);

  return extrairTexto({
    conteudo,
    tipoMime: fonte.tipoMime,
    nomeArquivoOriginal: fonte.nomeArquivoOriginal,
  });
}
