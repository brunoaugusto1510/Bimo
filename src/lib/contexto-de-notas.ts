import { z } from "zod";
import type { RepositorioDeNotas } from "./repositorio-de-notas/tipos";
import type { AnexoDeNota, IdDeNota } from "./types";
import { juntarCaminho } from "./caminho-da-nota";

export const MAXIMO_DE_NOTAS_DE_CONTEXTO = 10;
export const MAXIMO_DE_CARACTERES_DE_CONTEXTO = 60_000;
export const esquemaDeNotasDeContexto = z.array(z.string().trim().min(1).max(100))
  .max(MAXIMO_DE_NOTAS_DE_CONTEXTO).transform((ids) => [...new Set(ids)]);
export const esquemaDeAnexos = z.array(z.object({
  id: z.string().min(1).max(100), titulo: z.string().min(1).max(500),
  pasta: z.string().max(2_000).nullable(), revisao: z.number().int().nonnegative(),
})).max(MAXIMO_DE_NOTAS_DE_CONTEXTO);

export class ErroDeContexto extends Error {
  constructor(readonly status: 400 | 409 | 413, mensagem: string, readonly indisponiveis: IdDeNota[] = []) {
    super(mensagem);
    this.name = "ErroDeContexto";
  }
}

/** Conteúdo salvo, carregado pelo servidor; IDs nunca são interpretados como caminhos. */
export async function carregarContextoDeNotas(repositorio: RepositorioDeNotas, ids: IdDeNota[]) {
  const validado = esquemaDeNotasDeContexto.safeParse(ids);
  if (!validado.success) throw new ErroDeContexto(400, "Selecione até dez notas válidas.");
  const notas = await Promise.all(validado.data.map((id) => repositorio.obterNota(id)));
  const indisponiveis = validado.data.filter((_, i) => !notas[i]);
  if (indisponiveis.length) throw new ErroDeContexto(409, "Há notas indisponíveis no contexto. Remova-as ou restaure-as antes de enviar.", indisponiveis);
  const completas = notas.filter((nota) => nota !== null);
  const anexos: AnexoDeNota[] = completas.map(({ id, titulo, pasta, revisao }) => ({ id, titulo, pasta, revisao }));
  const texto = completas.length ? JSON.stringify(completas.map(({ id, titulo, pasta, revisao, conteudo }) => ({
    id, titulo, caminho: juntarCaminho(pasta, titulo), revisao, conteudo,
  }))) : "";
  if (texto.length > MAXIMO_DE_CARACTERES_DE_CONTEXTO) throw new ErroDeContexto(413, "As notas ultrapassam 60 mil caracteres de contexto. Reduza a seleção para enviar.");
  return { anexos, texto };
}
