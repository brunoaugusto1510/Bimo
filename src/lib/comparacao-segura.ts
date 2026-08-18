import { timingSafeEqual } from "node:crypto";

/**
 * Compara dois textos em tempo constante.
 *
 * Um `===` normal para no primeiro caractere diferente, e essa diferença de
 * tempo vaza o prefixo correto para quem medir com paciência. Usado tanto para
 * a assinatura da sessão quanto para o hash da senha.
 *
 * O tamanho continua vazando (não tem como esconder), então nunca use isto para
 * comparar segredos de tamanho variável, e sim os derivados de tamanho fixo
 * deles — HMAC e hash de scrypt são exatamente isso.
 */
export function iguaisEmTempoConstante(a: string, b: string): boolean {
  const bytesA = Buffer.from(a, "utf8");
  const bytesB = Buffer.from(b, "utf8");

  if (bytesA.length !== bytesB.length) return false;

  return timingSafeEqual(bytesA, bytesB);
}
