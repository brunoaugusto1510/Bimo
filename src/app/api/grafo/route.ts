import { exigirSessao } from "@/lib/autenticacao";
import { tratarErroDeRepositorio } from "@/lib/http-de-notas";
import { obterRepositorio } from "@/lib/repositorio-de-notas";
import { obterDadosDaPagina } from "@/lib/servico-de-notas";

/**
 * O grafo atual, para quem precisa atualizá-lo sem recarregar a página (a aba
 * Gráfico depois de editar). O aviso de listagem incompleta, se houver, vai junto.
 */
export async function GET(request: Request) {
  const semSessao = exigirSessao(request);
  if (semSessao) return semSessao;

  try {
    const repositorio = await obterRepositorio();
    const dados = await obterDadosDaPagina(repositorio);
    if (new URL(request.url).searchParams.get("comArvore") === "1") return Response.json(dados, { headers: { "Cache-Control": "no-store" } });
    const { grafo, aviso } = dados;
    return Response.json({ ...grafo, aviso });
  } catch (erro) {
    return tratarErroDeRepositorio(erro, "GET /api/grafo");
  }
}
