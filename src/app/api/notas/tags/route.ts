import { exigirSessao } from "@/lib/autenticacao";
import { tratarErroDeRepositorio } from "@/lib/http-de-notas";
import { obterRepositorio } from "@/lib/repositorio-de-notas";
import { obterTags } from "@/lib/servico-de-notas";

export async function GET(request: Request) {
  const semSessao = exigirSessao(request);
  if (semSessao) return semSessao;

  try {
    const repositorio = await obterRepositorio();
    return Response.json({ tags: await obterTags(repositorio) }, { headers: { "Cache-Control": "no-store" } });
  } catch (erro) {
    return tratarErroDeRepositorio(erro, "GET /api/notas/tags");
  }
}
