import { exigirSessao } from "@/lib/autenticacao";
import { respostaDeErro, tratarErroDeRepositorio } from "@/lib/http-de-notas";
import { obterRepositorio } from "@/lib/repositorio-de-notas";
import { buscarConteudo } from "@/lib/servico-de-notas";
import { esquemaDeBusca, mensagemDoPrimeiroErro } from "@/lib/validacao-de-notas";

/**
 * Busca no texto das notas (a seção "No conteúdo" da paleta). A busca por
 * título roda no navegador, sobre a lista que já está na tela — esta é só
 * para o que precisa ir ao servidor.
 *
 * Fica ao lado de `[id]`: o segmento fixo `busca` tem precedência sobre o dinâmico.
 */
export async function GET(request: Request) {
  const semSessao = exigirSessao(request);
  if (semSessao) return semSessao;

  const parametros = Object.fromEntries(new URL(request.url).searchParams);
  const validado = esquemaDeBusca.safeParse(parametros);
  if (!validado.success) return respostaDeErro(400, mensagemDoPrimeiroErro(validado.error));

  try {
    const repositorio = await obterRepositorio();
    const resultados = await buscarConteudo(repositorio, validado.data.q, validado.data.limite);
    return Response.json({ resultados });
  } catch (erro) {
    return tratarErroDeRepositorio(erro, "GET /api/notas/busca");
  }
}
