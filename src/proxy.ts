import { NextResponse } from "next/server";
import { respostaDeDesafio, verificarCredenciais } from "@/lib/autenticacao";

/**
 * A tranca da frente do Bimo: roda antes de qualquer rota e exige basic auth.
 *
 * No Next 16 este arquivo se chama `proxy.ts` — o antigo `middleware.ts` foi
 * deprecado e renomeado (e o runtime aqui é sempre Node, não dá para escolher).
 *
 * O `matcher` abaixo protege a home *e* as rotas de API. Isso é essencial:
 * `/api/notas/...` serve o conteúdo de qualquer nota, então deixá-la de fora
 * seria trancar a porta e esquecer a janela aberta.
 */
export function proxy(request: Request) {
  const resultado = verificarCredenciais(request);

  if (resultado.tipo !== "ok") {
    return respostaDeDesafio(resultado);
  }

  return NextResponse.next();
}

export const config = {
  /*
   * Casa com tudo, menos o que o navegador precisa buscar antes de haver login:
   * - _next/static e _next/image: CSS/JS/imagens (barrá-los quebraria até a
   *   renderização da própria tela de erro)
   * - favicon.ico: ícone da aba
   *
   * Note que `api` NÃO está na lista de exclusões, de propósito.
   */
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
