/**
 * Quem, no navegador, fala com as rotas `/api/notas/*`. Concentra o que todo
 * `fetch` de nota precisa — escapar o id, transformar a recusa do servidor numa
 * mensagem legível, deixar passar o cancelamento — para os componentes não
 * repetirem isso (nem cada um inventar o próprio texto de erro).
 */

import type { LigacoesDaNota } from "./servico-de-notas";
import { criarPrevia } from "./previa-de-nota";
import type { CapacidadesDoRepositorio, IdDeNota, NotaCompleta, ResultadoDeBusca, MudancasDeNota } from "./repositorio-de-notas/tipos";

export type ResultadoDoSalvamento =
  | { tipo: "ok"; nota: NotaCompleta }
  | { tipo: "conflito"; atual: NotaCompleta }
  | { tipo: "titulo-em-uso" | "nao-encontrada" | "somente-leitura" | "grande-demais" };

export async function salvarNota(
  id: IdDeNota,
  mudancas: MudancasDeNota,
  opcoes: { revisaoBase: number; checkpoint?: boolean },
  transporte: { sinal?: AbortSignal; keepalive?: boolean } = {},
): Promise<ResultadoDoSalvamento> {
  let resposta: Response;
  try {
    resposta = await fetch(`/api/notas/${encodeURIComponent(id)}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...mudancas, ...opcoes }), signal: transporte.sinal ?? AbortSignal.timeout(20000), keepalive: transporte.keepalive,
    });
  } catch (erro) {
    if (erro instanceof DOMException && erro.name === "AbortError") throw erro;
    throw new ErroDoCliente("Não consegui falar com o servidor.");
  }
  const corpo = await resposta.json().catch(() => null);
  if (resposta.ok && corpo?.nota) { esquecerPrevias(); return { tipo: "ok", nota: corpo.nota }; }
  if (resposta.status === 409 && corpo?.tipo === "conflito" && corpo.atual) return { tipo: "conflito", atual: corpo.atual };
  if (resposta.status === 409 && corpo?.tipo === "titulo-em-uso") return { tipo: "titulo-em-uso" };
  if (resposta.status === 404) return { tipo: "nao-encontrada" };
  if (resposta.status === 413) return { tipo: "grande-demais" };
  if (resposta.status === 403 && corpo?.tipo === "somente-leitura") return { tipo: "somente-leitura" };
  throw new ErroDoCliente("Não foi possível salvar. Tente de novo.", resposta.status);
}

export type RespostaDeNota = { nota: NotaCompleta; capacidades: CapacidadesDoRepositorio };

/** O que a prévia ao passar o mouse mostra. */
export type PreviaDeNota = { titulo: string; pasta: string | null; trecho: string };

/** Uma recusa do servidor (`status`) ou uma falha de rede (sem `status`), já com mensagem para mostrar. */
export class ErroDoCliente extends Error {
  constructor(
    mensagem: string,
    readonly status?: number,
  ) {
    super(mensagem);
    this.name = "ErroDoCliente";
  }
}

async function pedir<T>(url: string, sinal?: AbortSignal): Promise<T> {
  let resposta: Response;
  try {
    resposta = await fetch(url, { signal: sinal });
  } catch (erro) {
    // Cancelar (a pessoa trocou de nota) não é uma falha a mostrar: quem chamou já sabe.
    if (erro instanceof DOMException && erro.name === "AbortError") throw erro;
    throw new ErroDoCliente("Não consegui falar com o servidor.");
  }

  let corpo: { erro?: string } | null = null;
  try {
    corpo = await resposta.json();
  } catch {
    // Corpo que não é JSON (um erro do proxy, por exemplo): tratado abaixo.
  }

  if (!resposta.ok) {
    throw new ErroDoCliente(corpo?.erro ?? "Não foi possível concluir o pedido. Tente de novo.", resposta.status);
  }
  return corpo as T;
}

export function buscarNota(id: IdDeNota, sinal?: AbortSignal): Promise<RespostaDeNota> {
  return pedir(`/api/notas/${encodeURIComponent(id)}`, sinal);
}

export function buscarLigacoes(id: IdDeNota, sinal?: AbortSignal): Promise<LigacoesDaNota> {
  return pedir(`/api/notas/${encodeURIComponent(id)}/ligacoes`, sinal);
}

export async function buscarNoConteudo(consulta: string, limite = 10, sinal?: AbortSignal): Promise<ResultadoDeBusca[]> {
  const { resultados } = await pedir<{ resultados: ResultadoDeBusca[] }>(
    `/api/notas/busca?q=${encodeURIComponent(consulta)}&limite=${limite}`,
    sinal,
  );
  return resultados;
}

/** As prévias já pedidas (ou em andamento), por id. Uma falha sai daqui para a próxima tentativa refazer. */
const previas = new Map<IdDeNota, Promise<PreviaDeNota | null>>();

/** `null` quando a nota não pôde ser lida: a prévia é um extra e nunca deve virar uma tela de erro. */
export function buscarPrevia(id: IdDeNota): Promise<PreviaDeNota | null> {
  const guardada = previas.get(id);
  if (guardada) return guardada;

  const pedido = buscarNota(id)
    .then(({ nota }): PreviaDeNota => ({ titulo: nota.titulo, pasta: nota.pasta, trecho: criarPrevia(nota.conteudo) }))
    .catch(() => {
      previas.delete(id);
      return null;
    });
  previas.set(id, pedido);
  return pedido;
}

/** Descarta as prévias guardadas — depois de uma edição elas estariam velhas. */
export function esquecerPrevias(): void {
  previas.clear();
}
