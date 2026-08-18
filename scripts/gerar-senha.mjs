import { randomBytes, scryptSync } from "node:crypto";
import { createInterface } from "node:readline";

/**
 * Gera o valor de SENHA_HASH a partir de uma senha digitada.
 *
 * O formato e os parâmetros TÊM que casar com `src/lib/senha.ts`: separador `:`
 * (nunca `$` — o dotenv-expand comeria), sal de 16 bytes, chave de 32 bytes e
 * scrypt com as opções padrão do Node. O teste "aceita um hash gerado com os
 * mesmos parâmetros do script", em `senha.test.ts`, existe justamente para
 * quebrar se um dos dois lados mudar sem o outro.
 *
 * A senha é lida do stdin, e não de argv, para não ficar no histórico do shell.
 * Aviso: o terminal ainda mostra o que você digita — é uma ferramenta local de
 * uso único, não um prompt de senha de verdade.
 */

const TAMANHO_DA_CHAVE = 32;
const TAMANHO_DO_SAL = 16;

const leitor = createInterface({ input: process.stdin, output: process.stdout });

leitor.question("Senha: ", (senha) => {
  leitor.close();

  if (!senha) {
    console.error("Senha vazia — nada a fazer.");
    process.exit(1);
  }

  const salHex = randomBytes(TAMANHO_DO_SAL).toString("hex");
  const chave = scryptSync(senha, salHex, TAMANHO_DA_CHAVE).toString("hex");

  console.log("\nColoque isto em SENHA_HASH (.env.local e na Vercel):\n");
  console.log(`scrypt:${salHex}:${chave}`);
});
