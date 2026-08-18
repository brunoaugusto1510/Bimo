import {
  NOME_DO_COOKIE,
  verificarTokenDeSessao,
  type ResultadoDaSessao,
} from "./sessao";

/**
 * A tranca do Bimo, do ponto de vista de quem recebe uma requisição.
 *
 * A decisão em si mora no `sessao.ts` (assinatura e validade do token). Aqui
 * fica só a ponte com o mundo HTTP: achar o cookie no cabeçalho e transformar
 * uma recusa na resposta certa.
 *
 * Quem chama: o `proxy.ts` (barra tudo na borda) e cada rota de API. A doc do
 * Next 16 recomenda não confiar só no proxy, porque uma mudança de `matcher`
 * pode silenciosamente descobrir uma rota.
 */

/** Tudo menos "valida" — assim a resposta de recusa não aceita um acesso ok. */
export type RecusaDeSessao = Exclude<ResultadoDaSessao, { tipo: "valida" }>;

/**
 * Lê um cookie do cabeçalho cru.
 *
 * Não usamos `cookies()` do `next/headers` porque isto precisa funcionar tanto
 * no proxy quanto nas rotas, e o cabeçalho é o denominador comum dos dois.
 */
export function lerCookie(request: Request, nome: string): string | undefined {
  const cabecalho = request.headers.get("cookie");
  if (!cabecalho) return undefined;

  for (const parte of cabecalho.split(";")) {
    const igual = parte.indexOf("=");
    if (igual === -1) continue;

    if (parte.slice(0, igual).trim() === nome) {
      return parte.slice(igual + 1).trim();
    }
  }

  return undefined;
}

export function verificarSessaoDoPedido(request: Request): ResultadoDaSessao {
  return verificarTokenDeSessao(lerCookie(request, NOME_DO_COOKIE));
}

export function respostaDeRecusaParaApi(recusa: RecusaDeSessao): Response {
  // Problema de configuração não é culpa de quem está pedindo: 503 e a mensagem
  // explicando o que falta, para não parecer senha errada.
  if (recusa.tipo === "nao-configurado") {
    return Response.json({ erro: recusa.mensagem }, { status: 503 });
  }

  return Response.json(
    { erro: "Sessão inválida ou expirada. Faça login novamente." },
    { status: 401 },
  );
}

/**
 * Açúcar para as rotas: devolve a resposta de recusa, ou `null` se pode passar.
 * Deixa o começo de cada rota em duas linhas em vez de seis.
 */
export function exigirSessao(request: Request): Response | null {
  const sessao = verificarSessaoDoPedido(request);
  return sessao.tipo === "valida" ? null : respostaDeRecusaParaApi(sessao);
}

/**
 * Atributos do cookie de sessão, num só lugar para login e logout não
 * divergirem — um `path` diferente entre os dois faria o logout "não funcionar"
 * de um jeito difícil de enxergar.
 *
 * `secure` fica de fora em desenvolvimento porque o navegador descarta cookie
 * `Secure` em `http://localhost`.
 */
export function opcoesDoCookieDeSessao() {
  return {
    name: NOME_DO_COOKIE,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
  };
}
