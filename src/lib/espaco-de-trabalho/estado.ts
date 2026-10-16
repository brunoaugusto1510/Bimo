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
/** Quantas notas o histórico de uma aba lembra; ao passar disso, as mais antigas saem. */
export const LIMITE_DO_HISTORICO = 100;

export const ESTADO_INICIAL: EstadoDoEspaco = { abas: [], ativa: ABA_DO_GRAFICO, proximaChave: 1, recentes: [] };

export function idAtual(aba: AbaDeNota): IdDeNota {
  return aba.historico.pilha[aba.historico.indice];
}

/** A aba ativa, ou `null` quando é o gráfico. */
export function abaAtiva(estado: EstadoDoEspaco): Aba | null {
  if (estado.ativa === ABA_DO_GRAFICO) return null;
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
      const novaPilha = [...pilha.slice(0, indice + 1), id].slice(-LIMITE_DO_HISTORICO);
      const navegada: AbaDeNota = { ...ativa, historico: { pilha: novaPilha, indice: novaPilha.length - 1 } };
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

  // Uma nota fica aberta em uma aba só: se o destino já é a nota de outra aba, é lá que se vai.
  const destino = ativa.historico.pilha[indice];
  const jaAberta = estado.abas.find((aba) => aba !== ativa && aba.tipo === "nota" && idAtual(aba) === destino);
  if (jaAberta) return { ...estado, ativa: jaAberta.chave };

  const andada: AbaDeNota = { ...ativa, historico: { ...ativa.historico, indice } };
  return { ...estado, abas: estado.abas.map((aba) => (aba === ativa ? andada : aba)) };
}

/**
 * Tira do histórico as notas que não existem mais (e junta repetidas que ficaram lado a lado,
 * senão "voltar" pareceria parado). Devolve a mesma aba se nada mudou, ou `null` se não sobrou nenhuma.
 */
function limparAba(aba: AbaDeNota, existentes: ReadonlySet<IdDeNota>): AbaDeNota | null {
  const { pilha, indice } = aba.historico;

  const nova: IdDeNota[] = [];
  /** Onde, na pilha nova, cada posição da antiga foi parar (as que saíram apontam para a vizinha anterior). */
  const destinoDe: number[] = [];
  for (const id of pilha) {
    if (existentes.has(id) && nova[nova.length - 1] !== id) nova.push(id);
    destinoDe.push(nova.length - 1);
  }

  if (nova.length === pilha.length) return aba;
  if (nova.length === 0) return null;
  return { ...aba, historico: { pilha: nova, indice: Math.max(destinoDe[indice], 0) } };
}

function descartarInexistentes(estado: EstadoDoEspaco, existentes: ReadonlySet<IdDeNota>): EstadoDoEspaco {
  // Uma lista vazia quase sempre é "ainda não carregou" ou "falhou ao carregar", não "todas as notas sumiram".
  if (existentes.size === 0) return estado;

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
  if (ativaSobrou) return { ...estado, abas, recentes };

  // O lugar da aba que saiu, medido na lista nova: quantas das que vinham antes dela ainda existem.
  const posicaoAntiga = estado.abas.findIndex((aba) => aba.chave === estado.ativa);
  const posicaoNova = estado.abas.slice(0, Math.max(posicaoAntiga, 0)).filter((aba) => abas.some((nova) => nova.chave === aba.chave)).length;
  return { ...estado, abas, recentes, ativa: vizinhaDe(abas, posicaoNova) };
}

/** A primeira chave numerada que nenhuma das abas usa. */
export function calcularProximaChave(abas: readonly Aba[]): number {
  // Só até 9 dígitos: acima disso o número perde a precisão e a "próxima" chave repetiria a atual.
  return 1 + abas.reduce((maior, aba) => Math.max(maior, Number(/^aba-(\d{1,9})$/.exec(aba.chave)?.[1] ?? 0)), 0);
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

    case "restaurar": {
      const { abas, ativa, proximaChave } = acao.estado;
      return {
        ...acao.estado,
        ativa: ativa === ABA_DO_GRAFICO || abas.some((aba) => aba.chave === ativa) ? ativa : ABA_DO_GRAFICO,
        proximaChave: Math.max(proximaChave, calcularProximaChave(abas)),
      };
    }
  }
}
