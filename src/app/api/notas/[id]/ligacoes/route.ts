import { exigirSessao } from "@/lib/autenticacao";
import { respostaDeErro, tratarErroDeRepositorio } from "@/lib/http-de-notas";
import { obterRepositorio } from "@/lib/repositorio-de-notas";
import { obterLigacoesDaNota } from "@/lib/servico-de-notas";
import { esquemaDeIdDeNota, mensagemDoPrimeiroErro } from "@/lib/validacao-de-notas";

type Contexto = { params: Promise<{ id: string }> };

/**
 * O que o painel lateral da nota mostra: o que ela cita, quem a cita (com o trecho em
 * volta) e títulos de outras notas que o texto menciona sem ligar. Vem separado da leitura
 * da nota porque precisa de todas as notas — a nota abre primeiro, o painel preenche depois.
 */
export async function GET(request: Request, { params }: Contexto) {
  const semSessao = exigirSessao(request);
  if (semSessao) return semSessao;

  const id = esquemaDeIdDeNota.safeParse((await params).id);
  if (!id.success) return respostaDeErro(400, mensagemDoPrimeiroErro(id.error));

  try {
    const repositorio = await obterRepositorio();
    const resultado = await obterLigacoesDaNota(repositorio, id.data);
    if (!resultado) return respostaDeErro(404, "Nota não encontrada.");

    return Response.json(resultado);
  } catch (erro) {
    return tratarErroDeRepositorio(erro, "GET /api/notas/[id]/ligacoes");
  }
}
