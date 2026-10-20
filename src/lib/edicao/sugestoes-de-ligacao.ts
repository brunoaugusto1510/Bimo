import { buscarPorTitulo, type Intervalo, type NotaParaBusca } from "../busca-por-titulo";
import { juntarCaminho } from "../caminho-da-nota";
import type { Resolvedor } from "../ligacoes";
import type { IdDeNota } from "../types";

export type SugestaoDeLigacao = {
  id: IdDeNota;
  titulo: string;
  pasta: string | null;
  /** O que vai entre `[[` e `]]`: o título, ou `Pasta/Título` quando só o título não leva a esta nota. */
  alvo: string;
  /** Onde a consulta casou no título, para destacar. */
  intervalos: Intervalo[];
};

export const LIMITE_DE_SUGESTOES = 8;

type Entrada = {
  notas: readonly NotaParaBusca[];
  consulta: string;
  /** A nota que está sendo editada: ligar para si mesma não ajuda. */
  idAtual: IdDeNota;
  pastaAtual: string | null;
  resolver: Resolvedor;
  limite?: number;
};

/**
 * As notas que a pessoa pode estar querendo ligar depois de digitar `[[`: a mesma busca da paleta
 * "Ir para nota", sem rede. O alvo é só o título quando o resolvedor leva a esta nota sem dúvida;
 * título repetido (ou que levaria a outra) vira `Pasta/Título`, para a ligação não mudar de destino
 * quando alguém criar uma nota com o mesmo nome.
 */
export function sugerirLigacoes({ notas, consulta, idAtual, pastaAtual, resolver, limite = LIMITE_DE_SUGESTOES }: Entrada): SugestaoDeLigacao[] {
  const candidatas = notas.filter((nota) => nota.id !== idAtual);
  return buscarPorTitulo(candidatas, consulta, [], limite).map(({ nota, intervalos }) => {
    const resolucao = resolver(nota.titulo, pastaAtual);
    const soOTitulo = resolucao.tipo === "resolvida" && resolucao.nota.id === nota.id;
    return { id: nota.id, titulo: nota.titulo, pasta: nota.pasta, alvo: soOTitulo ? nota.titulo : juntarCaminho(nota.pasta, nota.titulo), intervalos };
  });
}
