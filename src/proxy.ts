import { NextResponse, type NextRequest } from "next/server";
import { respostaDeRecusaParaApi, verificarSessaoDoPedido } from "@/lib/autenticacao";

/**
 * A tranca da frente do Bimo: roda antes de qualquer rota e exige sessão.
 *
 * No Next 16 este arquivo se chama `proxy.ts` — o antigo `middleware.ts` foi
 * deprecado e renomeado (e o runtime aqui é sempre Node, não dá para escolher).
 *
 * O `matcher` protege a home *e* as rotas de API. Isso é essencial:
 * `/api/notas/...` serve o conteúdo cru de qualquer nota, então deixá-la de fora
 * seria trancar a porta e esquecer a janela aberta.
 */

/** Caminhos que precisam funcionar justamente *antes* de existir sessão. */
const PUBLICOS = new Set(["/login", "/api/login", "/api/logout"]);

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLICOS.has(pathname)) return NextResponse.next();

  const sessao = verificarSessaoDoPedido(request);
  if (sessao.tipo === "valida") return NextResponse.next();

  // Falta de configuração não é pedido de login: mandar para a tela de senha
  // aqui esconderia a causa e o login falharia depois sem explicação nenhuma.
  if (sessao.tipo === "nao-configurado") return respostaDeRecusaParaApi(sessao);

  // Quem chamou a API espera JSON, não uma página de HTML.
  if (pathname.startsWith("/api/")) return respostaDeRecusaParaApi(sessao);

  const destino = request.nextUrl.clone();
  destino.pathname = "/login";
  destino.search = "";
  return NextResponse.redirect(destino);
}

export const config = {
  /*
   * Casa com tudo, menos o que o navegador precisa buscar antes de haver login:
   * - _next/static e _next/image: CSS/JS/imagens (barrá-los quebraria até a
   *   renderização da própria tela de login)
   * - favicon.ico: ícone da aba
   *
   * Note que `api` NÃO está na lista de exclusões, de propósito.
   */
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
