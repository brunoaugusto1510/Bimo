/**
 * O lado do cliente do fluxo de `/api/chat`: lê as linhas NDJSON conforme chegam
 * (cada ferramenta que o agente usa vira uma linha, e a resposta final fecha o
 * fluxo) e traduz cada passo no evento que o grafo mostra. Também aceita a
 * resposta JSON de sempre — é o que chega quando o servidor recusa antes de
 * começar o fluxo (sessão, validação) ou quando o pedido não pediu NDJSON.
 */

import type { PassoDoAgente } from "./rastro-do-agente";
import type { IdDeNota, UsoDeFerramenta } from "./types";

export type RespostaDoChat = { resposta: string; ferramentas: UsoDeFerramenta[] };

export type LinhaDePasso = {
  tipo: "passo";
  nome: string;
  resumo: string;
  erro: boolean;
  ids: IdDeNota[];
  argumentos: Record<string, unknown>;
  notaId?: IdDeNota;
};

type LinhaDoFluxo = LinhaDePasso | ({ tipo: "resposta" } & RespostaDoChat) | { tipo: "erro"; erro: string };

/** O suficiente de um `Response` — os testes antigos simulam só `ok` e `json`. */
type RespostaRecebida = {
  ok: boolean;
  headers?: { get(nome: string): string | null };
  body?: ReadableStream<Uint8Array> | null;
  json(): Promise<unknown>;
};

const ERRO_GENERICO = "O agente não conseguiu responder.";
const ERRO_DE_INTERRUPCAO = "A resposta do Bimo foi interrompida. Tente de novo.";

export async function lerRespostaDoChat(
  resposta: RespostaRecebida,
  aoPasso?: (linha: LinhaDePasso) => void,
): Promise<RespostaDoChat> {
  const tipo = resposta.headers?.get("content-type") ?? "";
  if (resposta.ok && resposta.body && tipo.includes("application/x-ndjson")) {
    return lerFluxo(resposta.body, aoPasso);
  }

  const dados = (await resposta.json()) as Partial<RespostaDoChat> & { erro?: string };
  if (!resposta.ok) throw new Error(dados.erro || ERRO_GENERICO);
  return { resposta: dados.resposta ?? "", ferramentas: dados.ferramentas ?? [] };
}

async function lerFluxo(corpo: ReadableStream<Uint8Array>, aoPasso?: (linha: LinhaDePasso) => void): Promise<RespostaDoChat> {
  const leitor = corpo.getReader();
  const decodificador = new TextDecoder();
  let pendente = "";

  // Cada linha completa é tratada assim que chega; o resto fica esperando o próximo pedaço.
  const tratar = (texto: string): RespostaDoChat | null => {
    const linha = interpretar(texto);
    if (!linha) return null;
    if (linha.tipo === "erro") throw new Error(linha.erro || ERRO_GENERICO);
    if (linha.tipo === "resposta") return { resposta: linha.resposta, ferramentas: linha.ferramentas ?? [] };
    try {
      aoPasso?.(linha);
    } catch {
      // Um efeito visual que falha não pode derrubar a conversa.
    }
    return null;
  };

  let terminou = false;
  try {
    for (;;) {
      const { value, done } = await leitor.read();
      pendente += decodificador.decode(value, { stream: !done });
      const linhas = pendente.split("\n");
      pendente = done ? "" : (linhas.pop() ?? "");
      for (const texto of linhas) {
        const final = tratar(texto);
        if (final) return final;
      }
      if (done) {
        terminou = true;
        break;
      }
    }
  } finally {
    // Saiu antes do fim (resposta ou erro chegaram): solta a conexão em vez de deixá-la pendurada.
    if (!terminou) leitor.cancel().catch(() => {});
    leitor.releaseLock();
  }
  throw new Error(ERRO_DE_INTERRUPCAO);
}

function interpretar(texto: string): LinhaDoFluxo | null {
  if (!texto.trim()) return null;
  try {
    const valor: unknown = JSON.parse(texto);
    if (typeof valor !== "object" || valor === null || !("tipo" in valor)) return null;
    return valor as LinhaDoFluxo;
  } catch {
    return null;
  }
}

const ehId = (valor: unknown): valor is IdDeNota => typeof valor === "string" && valor !== "";

/** O que o grafo mostra para cada passo; passos com erro ou sem nota não acendem nada. */
export function passoDoRastro(linha: LinhaDePasso): PassoDoAgente | null {
  if (linha.erro) return null;
  const ids = Array.isArray(linha.ids) ? linha.ids.filter(ehId) : [];
  const nota = ids[0] ?? (ehId(linha.notaId) ? linha.notaId : undefined);

  switch (linha.nome) {
    case "buscar_notas":
      return { tipo: "busca", ids };
    case "ler_nota":
      return nota ? { tipo: "leitura", id: nota } : null;
    case "criar_nota":
      return nota ? { tipo: "escrita", id: nota, criada: true } : null;
    case "editar_nota":
      return nota ? { tipo: "escrita", id: nota, criada: false } : null;
    default:
      return null;
  }
}
