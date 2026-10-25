/**
 * O que reescrever quando uma nota é renomeada ou muda de pasta: toda ligação
 * `[[...]]` que *apontava para ela* continua apontando. Pura — quem aplica
 * (memória, banco) só grava o resultado, na mesma operação da mudança.
 *
 * A regra é uma só: **a ligação segue a mesma nota**. Se o texto escrito ainda
 * resolve para ela depois da mudança, não se mexe; se não resolve mais (o título
 * mudou, a pasta mudou), ele é trocado; se passaria a resolver para *outra* nota
 * (um título novo igual ao de uma homônima, uma pasta nova com homônima), a
 * ligação ganha o caminho completo da nota certa.
 */

import { caminhoParaLigacao } from "../caminho-da-nota";
import type { NotaComConteudo } from "../indice-de-ligacoes";
import { criarResolvedor, reescreverLigacoes, trocarTituloNoAlvo } from "../ligacoes";
import type { IdDeNota } from "../types";

export type ConteudoReescrito = { id: IdDeNota; conteudo: string };

export type MudancaDeNota = { titulo?: string; pasta?: string | null };

/**
 * Só as notas cujo texto muda entram no resultado. As ligações são resolvidas
 * no estado *antes* e no estado *depois* da mudança, e a nota que contém a
 * ligação é vista da pasta onde estará.
 */
export function planejarMudanca(
  notas: readonly NotaComConteudo[],
  id: IdDeNota,
  mudanca: MudancaDeNota,
): ConteudoReescrito[] {
  const depois = notas.map((nota) =>
    nota.id === id
      ? {
          ...nota,
          titulo: mudanca.titulo ?? nota.titulo,
          pasta: mudanca.pasta === undefined ? nota.pasta : mudanca.pasta,
        }
      : nota,
  );
  const notaDepoisPorId = new Map(depois.map((nota) => [nota.id, nota]));

  const resolverAntes = criarResolvedor(notas);
  const resolverDepois = criarResolvedor(depois);
  const reescritas: ConteudoReescrito[] = [];

  for (const origem of notas) {
    const pastaDepois = notaDepoisPorId.get(origem.id)!.pasta;

    const conteudo = reescreverLigacoes(origem.conteudo, (ligacao) => {
      if (ligacao.anexo) return null;

      const antes = resolverAntes(ligacao.alvo, origem.pasta);
      if (antes.tipo === "nao-resolvida") return null;
      const alvoId = antes.nota.id;

      // O texto que a pessoa escreveu, ajustado ao título novo se era a nota renomeada.
      const candidato =
        alvoId === id && mudanca.titulo !== undefined ? trocarTituloNoAlvo(ligacao.alvo, mudanca.titulo) : ligacao.alvo;

      const resolvida = resolverDepois(candidato, pastaDepois);
      if (resolvida.tipo !== "nao-resolvida" && resolvida.nota.id === alvoId) {
        return candidato === ligacao.alvo ? null : candidato;
      }

      // Não serve mais, ou desviaria para outra nota: o caminho completo da nota certa.
      const destino = notaDepoisPorId.get(alvoId)!;
      return caminhoParaLigacao(destino.pasta, destino.titulo);
    });

    if (conteudo !== origem.conteudo) reescritas.push({ id: origem.id, conteudo });
  }

  return reescritas;
}

/** Renomear é a mudança de título. */
export function planejarRenomeacao(
  notas: readonly NotaComConteudo[],
  id: IdDeNota,
  novoTitulo: string,
): ConteudoReescrito[] {
  return planejarMudanca(notas, id, { titulo: novoTitulo });
}
