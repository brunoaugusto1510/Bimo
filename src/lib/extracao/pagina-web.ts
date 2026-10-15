/**
 * Extrator para HTML de página web, via Readability (o mesmo algoritmo do
 * "modo leitura" do Firefox) sobre um DOM construído com jsdom.
 *
 * Diferente de PDF/texto puro, uma página web tem muito ruído (menu,
 * rodapé, propaganda, cookie banner) — Readability isola o conteúdo
 * principal do artigo, em vez de devolver a página inteira.
 */

import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import { registrarExtrator } from "./registro";

async function extrairDePaginaWeb(conteudo: Buffer): Promise<string> {
  const dom = new JSDOM(conteudo.toString("utf-8"));
  const artigo = new Readability(dom.window.document).parse();

  if (!artigo?.textContent) {
    throw new Error("Não foi possível extrair conteúdo legível desta página.");
  }

  return artigo.textContent.trim();
}

registrarExtrator(["text/html"], extrairDePaginaWeb);
