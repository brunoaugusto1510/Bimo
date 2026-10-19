/**
 * Quem, no navegador, fala com as rotas `/api/notas/*`. Concentra o que todo
 * `fetch` de nota precisa — escapar o id, transformar a recusa do servidor numa
 * mensagem legível, deixar passar o cancelamento — para os componentes não
 * repetirem isso (nem cada um inventar o próprio texto de erro).
 */

import type { LigacoesDaNota } from "./servico-de-notas";
import { criarPrevia } from "./previa-de-nota";
import type { CapacidadesDoRepositorio, IdDeNota, NotaCompleta, ResultadoDeBusca, MudancasDeNota, EntradaDeNota } from "./repositorio-de-notas/tipos";

export type ResultadoDoSalvamento =
  | { tipo: "ok"; nota: NotaCompleta; notasReescritas?: number }
  | { tipo: "conflito"; atual: NotaCompleta }
  | { tipo: "titulo-em-uso"; idExistente?: IdDeNota }
  | { tipo: "nao-encontrada" | "somente-leitura" | "grande-demais" };

export async function salvarNota(
  id: IdDeNota,
  mudancas: MudancasDeNota,
  opcoes: { revisaoBase: number; checkpoint?: boolean },
  transporte: { sinal?: AbortSignal; keepalive?: boolean } = {},
): Promise<ResultadoDoSalvamento> {
  esquecerSemente(id);
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
  if (resposta.status === 409 && corpo?.tipo === "titulo-em-uso") return { tipo: "titulo-em-uso", idExistente: corpo.idExistente };
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
  const semente = consultarSemente(id);
  if (semente) { esquecerSemente(id); return Promise.resolve(semente); }
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


const sementes = new Map<IdDeNota, { resposta: RespostaDeNota; expira: number; timer: ReturnType<typeof setTimeout> }>();
export function esquecerSemente(id: IdDeNota): void { clearTimeout(sementes.get(id)?.timer); sementes.delete(id); }
export function semearNota(resposta: RespostaDeNota): void {
  const id = resposta.nota.id;
  esquecerSemente(id);
  sementes.set(id, { resposta, expira: Date.now() + 10000, timer: setTimeout(() => esquecerSemente(id), 10000) });
}
export function consultarSemente(id: IdDeNota): RespostaDeNota | undefined {
  const semente = sementes.get(id);
  if (semente && semente.expira > Date.now()) return semente.resposta;
  esquecerSemente(id); return undefined;
}
export type ResultadoDaCriacao =
  | { tipo: "ok"; nota: NotaCompleta; capacidades?: CapacidadesDoRepositorio }
  | { tipo: "titulo-em-uso"; idExistente: IdDeNota }
  | { tipo: "erro"; mensagem: string }
  | { tipo: "somente-leitura" | "grande-demais" };

async function escreverNota(url: string, entrada: unknown) {
  let resposta: Response;
  try {
    resposta = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(entrada), signal: AbortSignal.timeout(20000) });
  } catch { throw new ErroDoCliente("Não consegui falar com o servidor."); }
  const corpo = await resposta.json().catch(() => null);
  if (resposta.ok && corpo?.nota) { esquecerPrevias(); return { ...corpo, tipo: "ok" as const }; }
  if (resposta.status === 409 && corpo?.tipo === "titulo-em-uso" && typeof corpo.idExistente === "string") return { tipo: "titulo-em-uso" as const, idExistente: corpo.idExistente };
  if (resposta.status === 409 && corpo?.atual) return { tipo: "conflito" as const, atual: corpo.atual as NotaCompleta };
  if (resposta.status === 404) return { tipo: "nao-encontrada" as const };
  if (resposta.status === 403 && corpo?.tipo === "somente-leitura") return { tipo: "somente-leitura" as const };
  if (resposta.status === 413) return { tipo: "grande-demais" as const };
  return { tipo: "erro" as const, mensagem: corpo?.erro ?? "Não foi possível concluir o pedido. Tente de novo." };
}
export async function criarNota(entrada: EntradaDeNota): Promise<ResultadoDaCriacao> {
  const resultado = await escreverNota("/api/notas", entrada);
  if (resultado.tipo === "nao-encontrada" || resultado.tipo === "conflito") return { tipo: "erro", mensagem: "Não foi possível criar a nota." };
  return resultado;
}
export async function renomearNota(id: IdDeNota, titulo: string, revisaoBase: number): Promise<ResultadoDoSalvamento | { tipo: "erro"; mensagem: string }> {
  esquecerSemente(id);
  return escreverNota(`/api/notas/${encodeURIComponent(id)}/renomear`, { titulo, revisaoBase });
}
