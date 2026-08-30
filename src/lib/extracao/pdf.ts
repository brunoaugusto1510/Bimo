/**
 * Extrator para PDF, via `unpdf` (build serverless do PDF.js — funciona em
 * função serverless sem precisar de worker separado).
 *
 * Limitação conhecida: só extrai texto que já é texto no PDF. Um PDF
 * escaneado (imagem, sem camada de texto) devolve string vazia — OCR de
 * verdade é um problema à parte, fora de escopo por enquanto.
 */

import { extractText, getDocumentProxy } from "unpdf";
import { registrarExtrator } from "./registro";

async function extrairDePdf(conteudo: Buffer): Promise<string> {
  const documento = await getDocumentProxy(new Uint8Array(conteudo));
  const { text } = await extractText(documento, { mergePages: true });
  return text;
}

registrarExtrator(["application/pdf"], extrairDePdf);
