/**
 * O estado das abas do espaço de trabalho de notas, como um redutor puro.
 *
 * A aba "Gráfico" é fixa e nunca fica em `abas`: ela é só um valor de `ativa`
 * (`ABA_DO_GRAFICO`). As outras são de dois tipos — uma nota (com o histórico
 * de navegação dela, como um navegador) ou uma aba vazia ("Nenhuma nota
 * aberta"). Nada aqui toca em rede, DOM ou `localStorage`.
 */

import type { IdDeNota } from "../types";

export const ABA_DO_GRAFICO = "grafico";

export type ModoDaNota = "edicao" | "leitura";

export type AbaDeNota = {
  tipo: "nota";
  chave: string;
  /** A nota mostrada é `pilha[indice]`; voltar e avançar andam pela pilha. */
  historico: { pilha: IdDeNota[]; indice: number };
  modo: ModoDaNota;
};

export type AbaVazia = { tipo: "vazia"; chave: string };

export type Aba = AbaDeNota | AbaVazia;

export type EstadoDoEspaco = {
  abas: Aba[];
  /** A chave da aba ativa, ou `ABA_DO_GRAFICO`. */
  ativa: string;
  /** Só cresce: a chave de uma aba fechada nunca é reaproveitada. */
  proximaChave: number;
  /** Notas abertas por último, a mais recente primeiro. */
  recentes: IdDeNota[];
};

export type Acao =
  | { tipo: "abrir-nota"; id: IdDeNota; novaAba?: boolean }
  | { tipo: "fechar-aba"; chave: string }
  | { tipo: "ativar-aba"; chave: string }
  | { tipo: "nova-aba-vazia" }
  | { tipo: "voltar" }
  | { tipo: "avancar" }
  | { tipo: "alternar-modo"; chave: string }
  | { tipo: "descartar-inexistentes"; existentes: ReadonlySet<IdDeNota> }
  | { tipo: "restaurar"; estado: EstadoDoEspaco };

export const LIMITE_DE_RECENTES = 20;

export const ESTADO_INICIAL: EstadoDoEspaco = { abas: [], ativa: ABA_DO_GRAFICO, proximaChave: 1, recentes: [] };

export function idAtual(aba: AbaDeNota): IdDeNota {
  return aba.historico.pilha[aba.historico.indice];
}

/** A aba ativa, ou `null` quando é o gráfico. */
export function abaAtiva(estado: EstadoDoEspaco): Aba | null {
  return estado.abas.find((aba) => aba.chave === estado.ativa) ?? null;
}

function lembrar(recentes: readonly IdDeNota[], id: IdDeNota): IdDeNota[] {
  return [id, ...recentes.filter((outro) => outro !== id)].slice(0, LIMITE_DE_RECENTES);
}

function novaAbaDeNota(chave: string, id: IdDeNota): AbaDeNota {
  return { tipo: "nota", chave, historico: { pilha: [id], indice: 0 }, modo: "leitura" };
}

function abrirNota(estado: EstadoDoEspaco, id: IdDeNota, novaAba: boolean): EstadoDoEspaco {
  const recentes = lembrar(estado.recentes, id);

  const jaAberta = estado.abas.find((aba): aba is AbaDeNota => aba.tipo === "nota" && idAtual(aba) === id);
  if (jaAberta) return { ...estado, ativa: jaAberta.chave, recentes };

  const ativa = abaAtiva(estado);

  if (ativa && !novaAba) {
    if (ativa.tipo === "nota") {
      const { pilha, indice } = ativa.historico;
      const navegada: AbaDeNota = {
        ...ativa,
        historico: { pilha: [...pilha.slice(0, indice + 1), id], indice: indice + 1 },
      };
      return { ...estado, abas: estado.abas.map((aba) => (aba === ativa ? navegada : aba)), recentes };
    }
    // Uma aba vazia existe para ser preenchida: a nota toma o lugar dela.
    return {
      ...estado,
      abas: estado.abas.map((aba) => (aba === ativa ? novaAbaDeNota(ativa.chave, id) : aba)),
      recentes,
    };
  }

  const chave = `aba-${estado.proximaChave}`;
  const posicao = ativa ? estado.abas.indexOf(ativa) + 1 : estado.abas.length;
  const abas = [...estado.abas.slice(0, posicao), novaAbaDeNota(chave, id), ...estado.abas.slice(posicao)];
  return { ...estado, abas, ativa: chave, proximaChave: estado.proximaChave + 1, recentes };
}

/** Qual aba fica ativa quando a de `posicao` sai: a da direita (que ocupa o mesmo lugar), senão a da esquerda, senão o gráfico. */
function vizinhaDe(abasRestantes: readonly Aba[], posicao: number): string {
  return (abasRestantes[posicao] ?? abasRestantes[posicao - 1])?.chave ?? ABA_DO_GRAFICO;
}

function fecharAba(estado: EstadoDoEspaco, chave: string): EstadoDoEspaco {
  const posicao = estado.abas.findIndex((aba) => aba.chave === chave);
  if (posicao === -1) return estado;

  const abas = estado.abas.filter((aba) => aba.chave !== chave);
  return { ...estado, abas, ativa: estado.ativa === chave ? vizinhaDe(abas, posicao) : estado.ativa };
}

function andarNoHistorico(estado: EstadoDoEspaco, passo: -1 | 1): EstadoDoEspaco {
  const ativa = abaAtiva(estado);
  if (ativa?.tipo !== "nota") return estado;

  const indice = ativa.historico.indice + passo;
  if (indice < 0 || indice >= ativa.historico.pilha.length) return estado;

  const andada: AbaDeNota = { ...ativa, historico: { ...ativa.historico, indice } };
  return { ...estado, abas: estado.abas.map((aba) => (aba === ativa ? andada : aba)) };
}

/** Tira do histórico as notas que não existem mais; devolve a mesma aba se nada saiu, ou `null` se não sobrou nenhuma. */
function limparAba(aba: AbaDeNota, existentes: ReadonlySet<IdDeNota>): AbaDeNota | null {
  const { pilha, indice } = aba.historico;
  const mantidas = pilha.filter((id) => existentes.has(id));
  if (mantidas.length === pilha.length) return aba;
  if (mantidas.length === 0) return null;

  const mantidasAteAtual = pilha.slice(0, indice + 1).filter((id) => existentes.has(id)).length;
  return { ...aba, historico: { pilha: mantidas, indice: Math.max(mantidasAteAtual - 1, 0) } };
}

function descartarInexistentes(estado: EstadoDoEspaco, existentes: ReadonlySet<IdDeNota>): EstadoDoEspaco {
  const recentes = estado.recentes.filter((id) => existentes.has(id));

  let mudou = recentes.length !== estado.recentes.length;
  const abas: Aba[] = [];
  for (const aba of estado.abas) {
    const limpa = aba.tipo === "nota" ? limparAba(aba, existentes) : aba;
    if (limpa !== aba) mudou = true;
    if (limpa) abas.push(limpa);
  }
  if (!mudou) return estado;

  const ativaSobrou = estado.ativa === ABA_DO_GRAFICO || abas.some((aba) => aba.chave === estado.ativa);
  const posicaoAntiga = estado.abas.findIndex((aba) => aba.chave === estado.ativa);
  return { ...estado, abas, recentes, ativa: ativaSobrou ? estado.ativa : vizinhaDe(abas, Math.max(posicaoAntiga, 0)) };
}

/** A primeira chave numerada que nenhuma das abas usa. */
export function calcularProximaChave(abas: readonly Aba[]): number {
  return 1 + abas.reduce((maior, aba) => Math.max(maior, Number(/^aba-(\d+)$/.exec(aba.chave)?.[1] ?? 0)), 0);
}

export function reduzir(estado: EstadoDoEspaco, acao: Acao): EstadoDoEspaco {
  switch (acao.tipo) {
    case "abrir-nota":
      return abrirNota(estado, acao.id, acao.novaAba ?? false);

    case "fechar-aba":
      return fecharAba(estado, acao.chave);

    case "ativar-aba":
      if (acao.chave !== ABA_DO_GRAFICO && !estado.abas.some((aba) => aba.chave === acao.chave)) return estado;
      return { ...estado, ativa: acao.chave };

    case "nova-aba-vazia": {
      const vazia = estado.abas.find((aba) => aba.tipo === "vazia");
      if (vazia) return { ...estado, ativa: vazia.chave };

      const chave = `aba-${estado.proximaChave}`;
      const ativa = abaAtiva(estado);
      const posicao = ativa ? estado.abas.indexOf(ativa) + 1 : estado.abas.length;
      const abas = [...estado.abas.slice(0, posicao), { tipo: "vazia" as const, chave }, ...estado.abas.slice(posicao)];
      return { ...estado, abas, ativa: chave, proximaChave: estado.proximaChave + 1 };
    }

    case "voltar":
      return andarNoHistorico(estado, -1);

    case "avancar":
      return andarNoHistorico(estado, 1);

    case "alternar-modo":
      return {
        ...estado,
        abas: estado.abas.map((aba) =>
          aba.tipo === "nota" && aba.chave === acao.chave ? { ...aba, modo: aba.modo === "leitura" ? "edicao" : "leitura" } : aba,
        ),
      };

    case "descartar-inexistentes":
      return descartarInexistentes(estado, acao.existentes);

    case "restaurar":
      return {
        ...acao.estado,
        proximaChave: Math.max(acao.estado.proximaChave, calcularProximaChave(acao.estado.abas)),
      };
  }
}
