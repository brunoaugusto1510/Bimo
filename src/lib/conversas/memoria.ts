/**
 * Conversas na memória do processo — para testes e desenvolvimento sem banco
 * (`NOTAS_FONTE=memoria`, que `config.ts` recusa em produção). Cumpre o mesmo
 * contrato do banco.
 */

import type { Mensagem } from "../types";
import {
  ErroDeConversa,
  LIMITE_DA_LISTA,
  LIMITE_DE_MENSAGENS_ABERTAS,
  prepararMensagens,
  tituloDaConversa,
  type ConversaCompleta,
  type IdDeConversa,
  type RepositorioDeConversas,
  type ResumoDeConversa,
} from "./tipos";

type Guardada = { id: IdDeConversa; dono: string; titulo: string; atualizadaEm: number; mensagens: Mensagem[] };

/** As conversas de todos os donos; cada repositório só enxerga as do seu dono. */
export type ArmazemDeConversas = Map<IdDeConversa, Guardada>;

export function criarArmazemDeConversas(): ArmazemDeConversas {
  return new Map();
}

function paraResumo({ id, titulo, atualizadaEm }: Guardada): ResumoDeConversa {
  return { id, titulo, atualizadaEm: new Date(atualizadaEm).toISOString() };
}

export function criarRepositorioDeConversasEmMemoria(armazem: ArmazemDeConversas, dono = "unico"): RepositorioDeConversas {
  // Duas gravações no mesmo milissegundo precisam continuar ordenadas.
  let ultimoRelogio = 0;
  const agora = () => (ultimoRelogio = Math.max(Date.now(), ultimoRelogio + 1));

  const doDono = (id: IdDeConversa) => {
    const conversa = armazem.get(id);
    return conversa?.dono === dono ? conversa : undefined;
  };

  return {
    async listar(limite = LIMITE_DA_LISTA) {
      return [...armazem.values()]
        .filter((c) => c.dono === dono)
        .sort((a, b) => b.atualizadaEm - a.atualizadaEm)
        .slice(0, limite)
        .map(paraResumo);
    },

    async obter(id): Promise<ConversaCompleta | null> {
      const conversa = doDono(id);
      return conversa ? { conversa: paraResumo(conversa), mensagens: conversa.mensagens.slice(-LIMITE_DE_MENSAGENS_ABERTAS).map((m) => ({ ...m })) } : null;
    },

    async acrescentar(id, mensagens) {
      const novas = prepararMensagens(mensagens);
      const existente = armazem.get(id);
      if (existente && existente.dono !== dono) throw new ErroDeConversa("nao-encontrada", "Conversa não encontrada.");

      const conversa: Guardada = existente ?? { id, dono, titulo: tituloDaConversa(novas), atualizadaEm: 0, mensagens: [] };
      const jaGuardadas = new Set(conversa.mensagens.map((m) => m.id));
      const aindaNaoGuardadas = novas.filter((m) => !jaGuardadas.has(m.id));
      conversa.mensagens.push(...aindaNaoGuardadas);
      if (aindaNaoGuardadas.length > 0 || !existente) conversa.atualizadaEm = agora();
      armazem.set(id, conversa);
      return paraResumo(conversa);
    },

    async excluir(id) {
      return doDono(id) ? armazem.delete(id) : false;
    },
  };
}
