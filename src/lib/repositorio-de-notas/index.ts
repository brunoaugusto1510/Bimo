/**
 * O ponto de entrada do resto do app: devolve o repositório da fonte
 * configurada em `NOTAS_FONTE`. Quem usa notas (páginas, rotas, serviço) chama
 * só `obterRepositorio()` e nunca sabe se por trás há banco ou memória.
 *
 * A instância é guardada: o cache do serviço é por repositório, e uma instância
 * nova a cada chamada o inutilizaria.
 */

import { lerConfiguracaoDeNotas, type ConfiguracaoDeNotas } from "./config";
import { obterRepositorioEmMemoriaCompartilhado } from "./memoria";
import type { RepositorioDeNotas } from "./tipos";

/** No `globalThis` porque o Next empacota rotas e páginas separadas, cada uma com o seu módulo. */
const CHAVE_GLOBAL = Symbol.for("bimo.repositorio-de-notas");
type EmCache = { chave: string; repositorio: RepositorioDeNotas };
type ComCache = typeof globalThis & { [CHAVE_GLOBAL]?: EmCache };

function chaveDaConfiguracao(config: ConfiguracaoDeNotas): string {
  return config.fonte === "banco" ? `banco:${config.userId}` : config.fonte;
}

async function criar(config: ConfiguracaoDeNotas): Promise<RepositorioDeNotas> {
  switch (config.fonte) {
    case "memoria":
      return obterRepositorioEmMemoriaCompartilhado();
    case "banco": {
      const { criarRepositorioDoBanco } = await import("./banco");
      return criarRepositorioDoBanco(config.userId);
    }
  }
}

/**
 * Lança `ErroDeConfiguracao` quando a fonte está mal configurada — quem chama
 * (a página) mostra a tela de "falta configurar" em vez de quebrar.
 */
export async function obterRepositorio(): Promise<RepositorioDeNotas> {
  const config = lerConfiguracaoDeNotas();
  const chave = chaveDaConfiguracao(config);
  const global = globalThis as ComCache;

  if (global[CHAVE_GLOBAL]?.chave === chave) return global[CHAVE_GLOBAL].repositorio;

  const repositorio = await criar(config);
  global[CHAVE_GLOBAL] = { chave, repositorio };
  return repositorio;
}

/** Só para testes: esquece a instância guardada. */
export function esquecerRepositorioEmCache(): void {
  delete (globalThis as ComCache)[CHAVE_GLOBAL];
}
