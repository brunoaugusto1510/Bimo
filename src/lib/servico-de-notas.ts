/**
 * O que a interface precisa saber das notas, montado em cima de qualquer
 * repositório: a árvore da barra lateral, o grafo, e o detalhe de uma nota
 * (ligações de entrada e de saída, menções sem ligação).
 *
 * Tudo sai de uma única leitura das notas com conteúdo, guardada num cache por
 * repositório e válida enquanto a `marcaDeVersao` do repositório não muda —
 * toda escrita muda a marca sozinha, então não há "invalidar" para esquecer.
 */

import { montarGrafoDeNotas, type Grafo } from "./grafo-de-notas";
import { construirArvore } from "./arvore-de-notas";
import { extrairTags } from "./markdown-da-nota";
import {
  construirIndiceDeLigacoes,
  encontrarMencoesSemLigacao,
  type DestinoDeLigacao,
  type IndiceDeLigacoes,
  type LigacaoDeEntrada,
  type MencaoSemLigacao,
} from "./indice-de-ligacoes";
import type {
  CapacidadesDoRepositorio,
  IdDeNota,
  NotaCompleta,
  RepositorioDeNotas,
  ResultadoDeBusca,
} from "./repositorio-de-notas/tipos";
import type { ItemDeNotas } from "./types";

export type DadosDaPagina = {
  itens: ItemDeNotas[];
  grafo: Grafo;
  aviso?: string;
  capacidades: CapacidadesDoRepositorio;
};

export type LigacoesDaNota = {
  ligacoes: { saida: DestinoDeLigacao[]; entrada: LigacaoDeEntrada[] };
  /** Títulos de outras notas citados no texto sem `[[ligação]]` — a sugestão do Bimo. */
  mencoesSemLigacao: MencaoSemLigacao[];
};

type TagContada = { nome: string; quantidade: number };
/** `tags` é preenchido no primeiro pedido de tags: quem só quer a página ou o grafo não paga por contá-las. */
type Montado = { notas: NotaCompleta[]; indice: IndiceDeLigacoes; dados: DadosDaPagina; tags?: TagContada[] };

function contarTags(notas: NotaCompleta[]): TagContada[] {
  const contagens = new Map<string, TagContada>();
  for (const nota of notas) {
    const vistas = new Set<string>();
    for (const nome of [...nota.tags, ...extrairTags(nota.conteudo)]) {
      const chave = nome.toLowerCase();
      if (vistas.has(chave)) continue;
      vistas.add(chave);
      const existente = contagens.get(chave);
      if (existente) existente.quantidade++;
      else contagens.set(chave, { nome, quantidade: 1 });
    }
  }
  return [...contagens.values()].sort((a, b) => b.quantidade - a.quantidade || a.nome.localeCompare(b.nome, "pt-BR"));
}

const caches = new WeakMap<RepositorioDeNotas, { marca: string; montado: Promise<Montado> }>();

async function montar(repositorio: RepositorioDeNotas): Promise<Montado> {
  // O aviso vem depois da leitura: ele pode falar justamente de notas que a leitura não conseguiu trazer.
  const notas = await repositorio.listarComConteudo();
  const [configuracao, aviso] = await Promise.all([repositorio.obterConfiguracaoDoGrafo(), repositorio.obterAviso()]);
  const indice = construirIndiceDeLigacoes(notas);

  return {
    notas,
    indice,
    dados: {
      itens: construirArvore(notas),
      grafo: montarGrafoDeNotas({ notas, configuracao, indice }),
      aviso,
      capacidades: repositorio.capacidades,
    },
  };
}

async function obterMontado(repositorio: RepositorioDeNotas): Promise<Montado> {
  const marca = await repositorio.marcaDeVersao();
  const guardado = caches.get(repositorio);
  if (guardado?.marca === marca) return guardado.montado;

  const montado = montar(repositorio);
  caches.set(repositorio, { marca, montado });
  // Uma montagem que falhou não pode ficar guardada: a próxima chamada tenta de novo.
  montado.catch(() => {
    if (caches.get(repositorio)?.montado === montado) caches.delete(repositorio);
  });
  return montado;
}

export async function obterDadosDaPagina(repositorio: RepositorioDeNotas): Promise<DadosDaPagina> {
  return (await obterMontado(repositorio)).dados;
}

/** Tags da coluna e do texto, contadas por nota sobre a mesma leitura usada pela página. */
export async function obterTags(repositorio: RepositorioDeNotas): Promise<TagContada[]> {
  const montado = await obterMontado(repositorio);
  return (montado.tags ??= contarTags(montado.notas));
}

/**
 * Quem a nota cita, quem a cita e o que ela menciona sem ligar. Separado da leitura da nota
 * de propósito: isto precisa de todas as notas (no GitHub, centenas de downloads quando o
 * cache vence), e abrir uma nota não pode esperar por isso. O texto da própria nota vem
 * direto do repositório, sempre o mais novo.
 */
export async function obterLigacoesDaNota(
  repositorio: RepositorioDeNotas,
  id: IdDeNota,
): Promise<LigacoesDaNota | null> {
  const nota = await repositorio.obterNota(id);
  if (!nota) return null;

  const { notas, indice } = await obterMontado(repositorio);

  return {
    ligacoes: {
      saida: [...(indice.saidas.get(id) ?? [])],
      entrada: [...(indice.entradas.get(id) ?? [])],
    },
    mencoesSemLigacao: encontrarMencoesSemLigacao(nota, notas, indice),
  };
}

export function buscarConteudo(
  repositorio: RepositorioDeNotas,
  consulta: string,
  limite: number,
): Promise<ResultadoDeBusca[]> {
  return repositorio.buscarPorConteudo(consulta, limite);
}
