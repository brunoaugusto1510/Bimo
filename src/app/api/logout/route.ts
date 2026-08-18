import { NextResponse } from "next/server";
import { opcoesDoCookieDeSessao } from "@/lib/autenticacao";

/**
 * Sair: apaga o cookie de sessão.
 *
 * Fica liberada no `proxy.ts` de propósito. Se exigisse sessão válida, quem
 * tivesse um cookie já expirado receberia 401 ao tentar sair — pedindo login
 * para poder deslogar, que é um beco sem saída bobo.
 *
 * `maxAge: 0` é o que manda o navegador descartar na hora; os outros atributos
 * vêm de `opcoesDoCookieDeSessao` porque o navegador só substitui um cookie se
 * nome, domínio e path baterem com os do original.
 */
export async function POST() {
  const resposta = NextResponse.json({ ok: true });

  resposta.cookies.set({
    ...opcoesDoCookieDeSessao(),
    value: "",
    maxAge: 0,
  });

  return resposta;
}
