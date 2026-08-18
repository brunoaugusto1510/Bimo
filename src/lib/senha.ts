import { randomBytes, scryptSync } from "node:crypto";
import { iguaisEmTempoConstante } from "./comparacao-segura";

/**
 * A senha nunca é guardada em claro: `SENHA_HASH` recebe `scrypt:<sal>:<hash>`.
 *
 * Sejamos honestos sobre o que isso protege. Quem consegue ler as variáveis de
 * ambiente também lê `SEGREDO_SESSAO`, e com ela forja um cookie de sessão
 * direto — o hash não impede a entrada nesse cenário. O que ele impede é o
 * vazamento da *senha em si*, que é a informação que costuma estar reaproveitada
 * em outros lugares. É por isso que vale o passo extra, e só por isso.
 */

const ALGORITMO = "scrypt";

/*
 * `:` e não `$`, que seria o separador convencional (formato PHC). Motivo: o
 * `@next/env` passa o .env.local por dotenv-expand, e ali `$algo` é lido como
 * referência de variável — o hash chegava truncado em "scrypt" e o login dava
 * 503 só em desenvolvimento, porque na Vercel as variáveis não passam por
 * dotenv. Hex não contém `:`, então não há ambiguidade.
 */
const SEPARADOR = ":";
const TAMANHO_DA_CHAVE = 32;
const TAMANHO_DO_SAL = 16;

const MENSAGEM_SEM_HASH =
  "SENHA_HASH não está definida ou está num formato que não reconheço " +
  "(esperado: scrypt:<sal>:<hash>). Sem ela o Bimo recusa todo acesso. " +
  "Gere com npm run gerar-senha.";

export type ResultadoDaSenha =
  | { tipo: "ok" }
  | { tipo: "incorreta" }
  | { tipo: "nao-configurado"; mensagem: string };

/** O sal é parâmetro só para os testes; em uso real vem aleatório. */
export function gerarHashDeSenha(
  senha: string,
  salHex: string = randomBytes(TAMANHO_DO_SAL).toString("hex"),
): string {
  const chave = scryptSync(senha, salHex, TAMANHO_DA_CHAVE).toString("hex");
  return [ALGORITMO, salHex, chave].join(SEPARADOR);
}

export function verificarSenha(senha: string): ResultadoDaSenha {
  const guardado = process.env.SENHA_HASH;
  if (!guardado) return { tipo: "nao-configurado", mensagem: MENSAGEM_SEM_HASH };

  const partes = guardado.split(SEPARADOR);
  if (partes.length !== 3 || partes[0] !== ALGORITMO || !partes[1] || !partes[2]) {
    return { tipo: "nao-configurado", mensagem: MENSAGEM_SEM_HASH };
  }

  const [, salHex, chaveEsperada] = partes;

  let chave: string;
  try {
    chave = scryptSync(senha, salHex, TAMANHO_DA_CHAVE).toString("hex");
  } catch {
    // scrypt reclama de sal malformado — isso é configuração ruim, não senha errada.
    return { tipo: "nao-configurado", mensagem: MENSAGEM_SEM_HASH };
  }

  return iguaisEmTempoConstante(chave, chaveEsperada)
    ? { tipo: "ok" }
    : { tipo: "incorreta" };
}
