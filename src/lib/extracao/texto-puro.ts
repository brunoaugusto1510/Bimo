/** Extrator para Markdown/texto puro — o conteúdo já É o texto, sem processamento. */

import { registrarExtrator } from "./registro";

async function extrairTextoPuro(conteudo: Buffer): Promise<string> {
  return conteudo.toString("utf-8");
}

registrarExtrator(["text/markdown", "text/x-markdown", "text/plain"], extrairTextoPuro);
