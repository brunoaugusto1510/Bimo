import { randomBytes } from "node:crypto";

/**
 * Gera um valor para SEGREDO_SESSAO.
 *
 * 32 bytes em hexadecimal = 64 caracteres, bem acima do mínimo que o
 * `src/lib/sessao.ts` exige. Trocar este valor invalida todas as sessões
 * existentes de uma vez — é o botão de "desconectar todo mundo".
 */
console.log(randomBytes(32).toString("hex"));
