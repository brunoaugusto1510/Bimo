import { exigirSessao } from "@/lib/autenticacao";
import {
  exigirMesmaOrigem,
  lerJsonComLimite,
  respostaDeErro,
  respostaDeEscrita,
  tratarErroDeRepositorio,
} from "@/lib/http-de-notas";
import { obterRepositorio } from "@/lib/repositorio-de-notas";
import { esquemaDeIdDeNota, esquemaDeRenomeacao, mensagemDoPrimeiroErro } from "@/lib/validacao-de-notas";

type Contexto = { params: Promise<{ id: string }> };

/**
 * Renomear tem rota própria porque mexe em mais que uma nota: as ligações
 * `[[Antigo]]` das outras notas passam a `[[Novo]]` na mesma operação.
 */
export async function POST(request: Request, { params }: Contexto) {
  const semSessao = exigirSessao(request);
  if (semSessao) return semSessao;
  const outraOrigem = exigirMesmaOrigem(request);
  if (outraOrigem) return outraOrigem;

  const id = esquemaDeIdDeNota.safeParse((await params).id);
  if (!id.success) return respostaDeErro(400, mensagemDoPrimeiroErro(id.error));

  const corpo = await lerJsonComLimite(request);
  if (!corpo.ok) return corpo.resposta;

  const validado = esquemaDeRenomeacao.safeParse(corpo.dados);
  if (!validado.success) return respostaDeErro(400, mensagemDoPrimeiroErro(validado.error));

  try {
    const repositorio = await obterRepositorio();
    const resultado = await repositorio.renomearNota(id.data, validado.data.titulo, {
      revisaoBase: validado.data.revisaoBase,
      autor: { criadoPor: "usuario", ferramenta: "renomear_nota" },
    });
    return respostaDeEscrita(resultado);
  } catch (erro) {
    return tratarErroDeRepositorio(erro, "POST /api/notas/[id]/renomear");
  }
}
