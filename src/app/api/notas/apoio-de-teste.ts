/**
 * Ajudas dos testes das rotas de notas: o cookie de sessão válido e um
 * construtor de requisições. Não é rota (o Next só trata como rota o
 * `route.ts`), só fica junto de quem usa.
 */

import { NOME_DO_COOKIE, criarTokenDeSessao } from "@/lib/sessao";

export const SEGREDO_DE_TESTE = "um-segredo-de-testes-com-mais-de-32-caracteres";

type OpcoesDoPedido = {
  metodo?: string;
  corpo?: unknown;
  autenticado?: boolean;
  cabecalhos?: Record<string, string>;
};

/** Uma requisição JSON com cookie de sessão válido (a menos que `autenticado: false`). */
export function pedido(url: string, { metodo = "GET", corpo, autenticado = true, cabecalhos = {} }: OpcoesDoPedido = {}): Request {
  return new Request(`http://localhost${url}`, {
    method: metodo,
    headers: {
      ...(corpo === undefined ? {} : { "content-type": "application/json" }),
      ...(autenticado ? { cookie: `${NOME_DO_COOKIE}=${criarTokenDeSessao()}` } : {}),
      ...cabecalhos,
    },
    body: corpo === undefined ? undefined : typeof corpo === "string" ? corpo : JSON.stringify(corpo),
  });
}

export function contextoComId(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}
