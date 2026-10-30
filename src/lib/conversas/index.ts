/**
 * O ponto de entrada do histórico: devolve o repositório de conversas da mesma
 * fonte configurada para as notas (`NOTAS_FONTE`). Rotas chamam só
 * `obterRepositorioDeConversas()`.
 */

import { lerConfiguracaoDeNotas } from "../repositorio-de-notas/config";
import { criarArmazemDeConversas, criarRepositorioDeConversasEmMemoria, type ArmazemDeConversas } from "./memoria";
import type { RepositorioDeConversas } from "./tipos";

/** No `globalThis` porque o Next empacota cada rota com o seu módulo. */
const CHAVE_GLOBAL = Symbol.for("bimo.repositorio-de-conversas");
type EmCache = { chave: string; repositorio: RepositorioDeConversas };
type ComCache = typeof globalThis & { [CHAVE_GLOBAL]?: EmCache; [CHAVE_DO_ARMAZEM]?: ArmazemDeConversas };
const CHAVE_DO_ARMAZEM = Symbol.for("bimo.armazem-de-conversas-em-memoria");

/** Lança `ErroDeConfiguracao` quando a fonte está mal configurada, como `obterRepositorio`. */
export async function obterRepositorioDeConversas(): Promise<RepositorioDeConversas> {
  const config = lerConfiguracaoDeNotas();
  const chave = config.fonte === "banco" ? `banco:${config.userId}` : "memoria";
  const global = globalThis as ComCache;
  if (global[CHAVE_GLOBAL]?.chave === chave) return global[CHAVE_GLOBAL].repositorio;

  let repositorio: RepositorioDeConversas;
  if (config.fonte === "banco") {
    const { criarRepositorioDeConversasDoBanco } = await import("./banco");
    repositorio = criarRepositorioDeConversasDoBanco(config.userId);
  } else {
    global[CHAVE_DO_ARMAZEM] ??= criarArmazemDeConversas();
    repositorio = criarRepositorioDeConversasEmMemoria(global[CHAVE_DO_ARMAZEM]);
  }
  global[CHAVE_GLOBAL] = { chave, repositorio };
  return repositorio;
}

/** Só para testes: esquece o repositório e as conversas guardadas na memória. */
export function esquecerRepositorioDeConversasEmCache(): void {
  const global = globalThis as ComCache;
  delete global[CHAVE_GLOBAL];
  delete global[CHAVE_DO_ARMAZEM];
}
