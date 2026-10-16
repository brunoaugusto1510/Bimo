/**
 * Quem liga a quem. Tudo sai do texto das notas, na hora da leitura: as
 * ligações `[[...]]` que a pessoa vê escritas são exatamente as que existem,
 * sem uma segunda cópia para divergir. O grafo, os links de entrada e de saída
 * do painel lateral e a "sugestão do Bimo" partem daqui.
 */

import { normalizarTexto } from "./caminho-da-nota";
import { criarResolvedor, extrairLigacoes, type NotaParaResolver } from "./ligacoes";
import { mascararCodigo, trechoAoRedor } from "./markdown-da-nota";

export type NotaComConteudo = NotaParaResolver & { conteudo: string };

/** Para onde uma ligação aponta. */
export type DestinoDeLigacao =
  | {
      tipo: "nota";
      id: string;
      titulo: string;
      pasta: string | null;
      /** Há outra nota com o mesmo título; esta foi a escolhida pelo desempate. */
      ambigua: boolean;
    }
  | { tipo: "nao-resolvida"; alvo: string; titulo: string };

export type LigacaoDeEntrada = {
  /** A nota que contém a ligação. */
  id: string;
  titulo: string;
  pasta: string | null;
  /** Texto em volta da primeira ligação, para mostrar o contexto. */
  trecho: string;
};

export type IndiceDeLigacoes = {
  /** Destinos de cada nota, sem repetir, na ordem em que aparecem. Toda nota tem uma entrada. */
  saidas: ReadonlyMap<string, readonly DestinoDeLigacao[]>;
  /** Quem cita cada nota. Só existe entrada para nota citada por alguém. */
  entradas: ReadonlyMap<string, readonly LigacaoDeEntrada[]>;
};

/** Raio do trecho de contexto: ~160 caracteres no total, em volta da ligação. */
const RAIO_DO_TRECHO = 80;

function ultimoSegmento(alvo: string): string {
  return alvo.split("/").pop() ?? alvo;
}

export function construirIndiceDeLigacoes(notas: readonly NotaComConteudo[]): IndiceDeLigacoes {
  const resolver = criarResolvedor(notas);
  const saidas = new Map<string, DestinoDeLigacao[]>();
  const entradas = new Map<string, LigacaoDeEntrada[]>();

  for (const origem of notas) {
    const destinos: DestinoDeLigacao[] = [];
    const vistos = new Set<string>();
    saidas.set(origem.id, destinos);

    for (const ligacao of extrairLigacoes(origem.conteudo)) {
      if (ligacao.anexo) continue;

      const resolucao = resolver(ligacao.alvo, origem.pasta);
      if (resolucao.tipo === "nao-resolvida") {
        const chave = `nao-resolvida:${normalizarTexto(ligacao.alvo)}`;
        if (vistos.has(chave)) continue;
        vistos.add(chave);
        destinos.push({ tipo: "nao-resolvida", alvo: ligacao.alvo, titulo: ultimoSegmento(ligacao.alvo) });
        continue;
      }

      const { nota: destino } = resolucao;
      if (destino.id === origem.id || vistos.has(destino.id)) continue;
      vistos.add(destino.id);

      destinos.push({
        tipo: "nota",
        id: destino.id,
        titulo: destino.titulo,
        pasta: destino.pasta,
        ambigua: resolucao.tipo === "ambigua",
      });

      const recebidas = entradas.get(destino.id) ?? [];
      recebidas.push({
        id: origem.id,
        titulo: origem.titulo,
        pasta: origem.pasta,
        trecho: trechoAoRedor(origem.conteudo, ligacao.inicio, RAIO_DO_TRECHO),
      });
      entradas.set(destino.id, recebidas);
    }
  }

  return { saidas, entradas };
}

export type MencaoSemLigacao = { id: string; titulo: string; pasta: string | null; ocorrencias: number };

/** Títulos de uma ou duas letras apareceriam em qualquer texto. */
const TAMANHO_MINIMO_DO_TITULO_CITADO = 3;

function escaparParaRegex(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** O texto sem código e sem as próprias ligações — o que sobra é prosa que pode citar outras notas. */
function prosaSemLigacoes(conteudo: string): string {
  const mascarado = mascararCodigo(conteudo);
  // Uma passada, com cursor: refazer a string inteira a cada ligação é quadrático.
  const pedacos: string[] = [];
  let cursor = 0;
  for (const { inicio, fim } of extrairLigacoes(conteudo)) {
    pedacos.push(mascarado.slice(cursor, inicio), " ".repeat(fim - inicio));
    cursor = fim;
  }
  pedacos.push(mascarado.slice(cursor));
  return normalizarTexto(pedacos.join(""));
}

/**
 * Notas cujo título aparece no texto sem estar ligado — a "sugestão do Bimo"
 * (versão determinística): "você escreveu sobre X; quer ligar a [[X]]?". As
 * mais citadas vêm primeiro.
 */
export function encontrarMencoesSemLigacao(
  nota: NotaComConteudo,
  todas: readonly NotaComConteudo[],
  indice: IndiceDeLigacoes,
  limite = 8,
): MencaoSemLigacao[] {
  const jaLigadas = new Set(
    (indice.saidas.get(nota.id) ?? []).flatMap((destino) => (destino.tipo === "nota" ? [destino.id] : [])),
  );
  const prosa = prosaSemLigacoes(nota.conteudo);
  const mencoes: MencaoSemLigacao[] = [];

  for (const outra of todas) {
    if (outra.id === nota.id || jaLigadas.has(outra.id)) continue;

    const titulo = normalizarTexto(outra.titulo);
    if (titulo.length < TAMANHO_MINIMO_DO_TITULO_CITADO) continue;

    const palavraInteira = new RegExp(
      `(?<![\\p{L}\\p{N}])${escaparParaRegex(titulo)}(?![\\p{L}\\p{N}])`,
      "gu",
    );
    const ocorrencias = prosa.match(palavraInteira)?.length ?? 0;
    if (ocorrencias > 0) mencoes.push({ id: outra.id, titulo: outra.titulo, pasta: outra.pasta, ocorrencias });
  }

  return mencoes.sort((a, b) => b.ocorrencias - a.ocorrencias || a.titulo.localeCompare(b.titulo, "pt-BR")).slice(0, limite);
}
