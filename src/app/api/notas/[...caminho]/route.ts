import { NextResponse } from "next/server";
import { exigirSessao } from "@/lib/autenticacao";
import { lerConteudoDaNota } from "@/lib/vault-real";

/**
 * `[...caminho]` é uma rota "catch-all": captura qualquer coisa depois de
 * /api/notas/, inclusive barras — necessário porque o caminho de uma nota
 * é algo como "Faculdade/Redes/TCP.md".
 *
 * Isso roda no servidor (toda rota dentro de app/api roda lá), então pode
 * usar o GITHUB_TOKEN com segurança — o cliente só recebe o conteúdo já lido.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ caminho: string[] }> },
) {
  // Mesma checagem do `proxy.ts`, repetida de propósito: esta rota entrega o
  // conteúdo cru de qualquer nota, então é a última que deve ficar sem tranca.
  const semSessao = exigirSessao(request);
  if (semSessao) return semSessao;

  const { caminho } = await params;
  const caminhoDaNota = caminho.join("/");

  try {
    const conteudo = await lerConteudoDaNota(caminhoDaNota);
    if (conteudo === null) {
      return NextResponse.json({ erro: `Nota "${caminhoDaNota}" não encontrada.` }, { status: 404 });
    }
    return NextResponse.json({ conteudo });
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : "Erro desconhecido.";
    return NextResponse.json({ erro: mensagem }, { status: 500 });
  }
}
