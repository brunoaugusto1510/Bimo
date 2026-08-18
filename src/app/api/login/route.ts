import { NextResponse } from "next/server";
import { opcoesDoCookieDeSessao } from "@/lib/autenticacao";
import {
  limparTentativas,
  registrarFalha,
  verificarLimite,
} from "@/lib/limite-de-tentativas";
import { verificarSenha } from "@/lib/senha";
import { criarTokenDeSessao, duracaoDaSessaoEmSegundos } from "@/lib/sessao";

/**
 * A única rota que existe para quem ainda não tem sessão (ver `PUBLICOS` no
 * `proxy.ts`). Recebe a senha e, se ela conferir, devolve o cookie assinado.
 *
 * A senha nunca sai daqui: não é logada, não volta no corpo da resposta e não é
 * guardada em lugar nenhum — só serve para derivar o hash e ser comparada.
 */

const SEGUNDOS_POR_MINUTO = 60;

function identificarQuemPede(request: Request): string {
  // Atrás de proxy (Vercel), o IP do cliente é o primeiro item de x-forwarded-for.
  const encaminhado = request.headers.get("x-forwarded-for");
  if (encaminhado) {
    const primeiro = encaminhado.split(",")[0]?.trim();
    if (primeiro) return primeiro;
  }

  return request.headers.get("x-real-ip") ?? "desconhecido";
}

function extrairSenha(corpo: unknown): string | null {
  if (typeof corpo !== "object" || corpo === null || !("senha" in corpo)) return null;

  const { senha } = corpo as { senha: unknown };
  return typeof senha === "string" ? senha : null;
}

export async function POST(request: Request) {
  const quem = identificarQuemPede(request);

  // O freio vem antes de qualquer trabalho: senão cada tentativa bloqueada
  // ainda pagaria o custo do scrypt, que é caro de propósito.
  const limite = verificarLimite(quem);
  if (limite.tipo === "bloqueado") {
    const minutos = Math.ceil(limite.segundosRestantes / SEGUNDOS_POR_MINUTO);
    return NextResponse.json(
      { erro: `Muitas tentativas. Tente de novo em ${minutos} minuto(s).` },
      { status: 429, headers: { "Retry-After": String(limite.segundosRestantes) } },
    );
  }

  let corpo: unknown;
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json(
      { erro: "Corpo da requisição não é um JSON válido." },
      { status: 400 },
    );
  }

  const senha = extrairSenha(corpo);
  if (senha === null) {
    return NextResponse.json({ erro: 'Envie {"senha": "..."}.' }, { status: 400 });
  }

  const resultado = verificarSenha(senha);

  if (resultado.tipo === "nao-configurado") {
    return NextResponse.json({ erro: resultado.mensagem }, { status: 503 });
  }

  if (resultado.tipo === "incorreta") {
    registrarFalha(quem);
    return NextResponse.json({ erro: "Senha incorreta." }, { status: 401 });
  }

  let token: string;
  try {
    token = criarTokenDeSessao();
  } catch (erro) {
    // Senha certa mas sem SEGREDO_SESSAO: dizer "senha incorreta" aqui seria
    // mentir e te fazer caçar o problema no lugar errado.
    const mensagem = erro instanceof Error ? erro.message : "Erro desconhecido.";
    return NextResponse.json({ erro: mensagem }, { status: 503 });
  }

  limparTentativas(quem);

  const resposta = NextResponse.json({ ok: true });
  resposta.cookies.set({
    ...opcoesDoCookieDeSessao(),
    value: token,
    maxAge: duracaoDaSessaoEmSegundos(),
  });

  return resposta;
}
