import { createHmac } from "node:crypto";
import { iguaisEmTempoConstante } from "./comparacao-segura";

/**
 * A sessão do Bimo é um cookie autoassinado: `<expiraEm>.<HMAC(expiraEm)>`.
 *
 * Não existe tabela de sessões porque não precisa — o servidor não guarda
 * estado nenhum, só confere se a assinatura bate com `SEGREDO_SESSAO`. É isso
 * que faz a coisa funcionar em serverless, onde cada requisição pode cair numa
 * instância diferente, sem memória compartilhada.
 *
 * Consequência aceita: não há como revogar uma sessão específica. Para derrubar
 * todas de uma vez, troque `SEGREDO_SESSAO` — toda assinatura antiga vira pó.
 */

export const NOME_DO_COOKIE = "bimo_sessao";

const DURACAO_DA_SESSAO_MS = 30 * 24 * 60 * 60 * 1000;

/** Chave de HMAC curta é chave fraca; 32 caracteres é o mínimo que aceitamos. */
const TAMANHO_MINIMO_DO_SEGREDO = 32;

const MENSAGEM_SEM_SEGREDO =
  "SEGREDO_SESSAO não está definida ou tem menos de 32 caracteres. Sem ela o " +
  "Bimo recusa todo acesso, para não expor o vault por descuido. Gere uma com " +
  "npm run gerar-segredo.";

export type ResultadoDaSessao =
  | { tipo: "valida" }
  | { tipo: "ausente" }
  | { tipo: "invalida" }
  | { tipo: "expirada" }
  | { tipo: "nao-configurado"; mensagem: string };

function lerSegredo(): string | null {
  const segredo = process.env.SEGREDO_SESSAO;
  if (!segredo || segredo.length < TAMANHO_MINIMO_DO_SEGREDO) return null;
  return segredo;
}

function assinar(dados: string, segredo: string): string {
  return createHmac("sha256", segredo).update(dados).digest("base64url");
}

/** `agoraMs` é injetável para os testes não dependerem do relógio real. */
export function criarTokenDeSessao(agoraMs: number = Date.now()): string {
  const segredo = lerSegredo();
  if (!segredo) throw new Error(MENSAGEM_SEM_SEGREDO);

  const expiraEm = String(agoraMs + DURACAO_DA_SESSAO_MS);
  return `${expiraEm}.${assinar(expiraEm, segredo)}`;
}

export function verificarTokenDeSessao(
  token: string | undefined,
  agoraMs: number = Date.now(),
): ResultadoDaSessao {
  const segredo = lerSegredo();
  if (!segredo) return { tipo: "nao-configurado", mensagem: MENSAGEM_SEM_SEGREDO };

  if (!token) return { tipo: "ausente" };

  const ponto = token.lastIndexOf(".");
  if (ponto <= 0) return { tipo: "invalida" };

  const dados = token.slice(0, ponto);
  const assinatura = token.slice(ponto + 1);

  // A assinatura é conferida ANTES de interpretar o conteúdo: nada que veio do
  // cliente merece confiança enquanto não se provar assinado por nós.
  if (!iguaisEmTempoConstante(assinatura, assinar(dados, segredo))) {
    return { tipo: "invalida" };
  }

  const expiraEm = Number(dados);
  if (!Number.isFinite(expiraEm)) return { tipo: "invalida" };

  return agoraMs >= expiraEm ? { tipo: "expirada" } : { tipo: "valida" };
}

export function duracaoDaSessaoEmSegundos(): number {
  return DURACAO_DA_SESSAO_MS / 1000;
}
