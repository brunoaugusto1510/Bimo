/**
 * Peças comuns das rotas de notas: proteção contra pedidos de outra origem,
 * leitura do corpo com limite, e a tradução de cada resultado do repositório
 * (e de cada erro) na resposta HTTP certa.
 *
 * A sessão continua sendo checada em cada rota com `exigirSessao` — aqui fica
 * o que é específico de quem escreve notas.
 */

import { ErroDeConfiguracao } from "./repositorio-de-notas/config";
import type { ResultadoDeEscrita, ResultadoDeRenomeacao } from "./repositorio-de-notas/tipos";

/**
 * O proxy do Next guarda até 10 MB do corpo e, acima disso, trunca sem avisar
 * (o JSON chegaria cortado). O limite próprio é bem menor e responde 413.
 */
export const LIMITE_DO_CORPO_EM_BYTES = 1_048_576;

export function respostaDeErro(status: number, mensagem: string, extras: Record<string, unknown> = {}): Response {
  return Response.json({ erro: mensagem, ...extras }, { status });
}

/**
 * Defesa extra além do cookie `SameSite=Lax`: um pedido que escreve só vale se
 * vier da própria página. Pedido sem `Origin` (curl, testes) passa — para ele
 * ainda vale o cookie de sessão; o navegador sempre manda `Origin` em POST/PATCH.
 */
export function exigirMesmaOrigem(request: Request): Response | null {
  const recusa = respostaDeErro(403, "Pedido de origem não permitida.");
  const origem = request.headers.get("origin");

  if (origem === null) {
    return request.headers.get("sec-fetch-site") === "cross-site" ? recusa : null;
  }

  let hostDaOrigem: string;
  try {
    hostDaOrigem = new URL(origem).host;
  } catch {
    return recusa;
  }

  // Atrás de um proxy o `Host` é o interno; o que a pessoa vê vem em `x-forwarded-host`.
  const host =
    request.headers.get("x-forwarded-host")?.split(",")[0].trim() ??
    request.headers.get("host") ??
    new URL(request.url).host;

  return hostDaOrigem === host ? null : recusa;
}

export type CorpoLido = { ok: true; dados: unknown } | { ok: false; resposta: Response };

/**
 * Lê o corpo como JSON sem aceitar mais que `LIMITE_DO_CORPO_EM_BYTES`. Conta
 * os bytes enquanto lê e para no limite, então não depende de um
 * `Content-Length` honesto.
 */
export async function lerJsonComLimite(request: Request): Promise<CorpoLido> {
  // O tipo exato, ignorando só os parâmetros (`; charset=utf-8`): um texto que apenas menciona
  // "application/json" (`text/plain;x=application/json`) é um tipo que o CORS dispensa de preflight.
  const tipo = request.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  if (tipo !== "application/json") {
    return { ok: false, resposta: respostaDeErro(415, "Envie o corpo como application/json.") };
  }

  const tamanhoDeclarado = Number(request.headers.get("content-length"));
  if (tamanhoDeclarado > LIMITE_DO_CORPO_EM_BYTES) return { ok: false, resposta: corpoGrandeDemais() };

  const leitor = request.body?.getReader();
  if (!leitor) return { ok: false, resposta: respostaDeErro(400, "O corpo da requisição está vazio.") };

  const pedacos: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await leitor.read();
    if (done) break;

    total += value.byteLength;
    if (total > LIMITE_DO_CORPO_EM_BYTES) {
      await leitor.cancel();
      return { ok: false, resposta: corpoGrandeDemais() };
    }
    pedacos.push(value);
  }

  const texto = new TextDecoder().decode(Buffer.concat(pedacos));
  if (texto.trim() === "") return { ok: false, resposta: respostaDeErro(400, "O corpo da requisição está vazio.") };

  try {
    return { ok: true, dados: JSON.parse(texto) };
  } catch {
    return { ok: false, resposta: respostaDeErro(400, "O corpo da requisição não é um JSON válido.") };
  }
}

function corpoGrandeDemais(): Response {
  return respostaDeErro(413, "A requisição é grande demais (o limite é 1 MB).");
}

/** Cada desfecho de uma escrita no repositório vira o status HTTP e o corpo que a interface espera. */
export function respostaDeEscrita(resultado: ResultadoDeEscrita | ResultadoDeRenomeacao, statusDeSucesso = 200): Response {
  switch (resultado.tipo) {
    case "ok":
      return Response.json(
        "notasReescritas" in resultado
          ? { nota: resultado.nota, notasReescritas: resultado.notasReescritas }
          : { nota: resultado.nota },
        { status: statusDeSucesso },
      );
    case "conflito":
      return respostaDeErro(409, "Esta nota mudou em outro lugar.", { tipo: "conflito", atual: resultado.atual });
    case "titulo-em-uso":
      return respostaDeErro(409, "Já existe uma nota com esse título nessa pasta.", {
        tipo: "titulo-em-uso",
        idExistente: resultado.idExistente,
      });
    case "nao-encontrada":
      return respostaDeErro(404, "Nota não encontrada.");
    case "somente-leitura":
      return respostaDeErro(403, "As notas estão em modo somente leitura nesta configuração.", {
        tipo: "somente-leitura",
      });
  }
}

/** O detalhe fica no log do servidor; quem pediu recebe só uma frase — mensagens de erro de banco podem vazar o esquema. */
export function respostaDeErroInterno(erro: unknown, contexto: string): Response {
  console.error(`${contexto}:`, erro);
  return respostaDeErro(500, "Não foi possível concluir o pedido. Tente de novo.");
}

/** Falta de configuração é 503 (e diz o que configurar); o resto é 500 genérico. */
export function tratarErroDeRepositorio(erro: unknown, contexto: string): Response {
  if (erro instanceof ErroDeConfiguracao) {
    return Response.json({ erro: erro.message, variaveis: erro.variaveis }, { status: 503 });
  }
  return respostaDeErroInterno(erro, contexto);
}
