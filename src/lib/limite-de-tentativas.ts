/**
 * Freio de força bruta no login.
 *
 * A URL do Bimo é pública e a senha é a única coisa entre o mundo e o vault,
 * então deixar o endpoint aceitar tentativas infinitas seria ingênuo.
 *
 * Limitação que precisa estar clara: o contador vive na memória do processo. Em
 * serverless cada instância tem o seu, e elas reiniciam — então isto é um freio,
 * não uma garantia. Para garantia de verdade seria preciso um contador externo
 * (Redis/KV) ou o rate limit da própria borda.
 */

const MAX_FALHAS = 5;
const JANELA_MS = 15 * 60 * 1000;

type Registro = { falhas: number; primeiraFalhaMs: number };

const registros = new Map<string, Registro>();

export type ResultadoDoLimite =
  | { tipo: "liberado" }
  | { tipo: "bloqueado"; segundosRestantes: number };

function janelaExpirou(registro: Registro, agoraMs: number): boolean {
  return agoraMs - registro.primeiraFalhaMs >= JANELA_MS;
}

export function verificarLimite(
  chave: string,
  agoraMs: number = Date.now(),
): ResultadoDoLimite {
  const registro = registros.get(chave);
  if (!registro) return { tipo: "liberado" };

  if (janelaExpirou(registro, agoraMs)) {
    registros.delete(chave);
    return { tipo: "liberado" };
  }

  if (registro.falhas < MAX_FALHAS) return { tipo: "liberado" };

  const restanteMs = JANELA_MS - (agoraMs - registro.primeiraFalhaMs);
  return { tipo: "bloqueado", segundosRestantes: Math.ceil(restanteMs / 1000) };
}

export function registrarFalha(chave: string, agoraMs: number = Date.now()): void {
  const registro = registros.get(chave);

  if (!registro || janelaExpirou(registro, agoraMs)) {
    registros.set(chave, { falhas: 1, primeiraFalhaMs: agoraMs });
    return;
  }

  registros.set(chave, { ...registro, falhas: registro.falhas + 1 });
}

/** Chamado depois de um login certo: quem acertou não deve carregar o histórico. */
export function limparTentativas(chave: string): void {
  registros.delete(chave);
}

/** Só para os testes — cada caso precisa começar de um estado limpo. */
export function esquecerTudo(): void {
  registros.clear();
}
