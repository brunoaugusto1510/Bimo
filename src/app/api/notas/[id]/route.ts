import { exigirSessao } from "@/lib/autenticacao";
import {
  exigirMesmaOrigem,
  lerJsonComLimite,
  respostaDeErro,
  respostaDeEscrita,
  tratarErroDeRepositorio,
} from "@/lib/http-de-notas";
import { obterRepositorio } from "@/lib/repositorio-de-notas";
import { esquemaDeAtualizacao, esquemaDeIdDeNota, mensagemDoPrimeiroErro } from "@/lib/validacao-de-notas";

type Contexto = { params: Promise<{ id: string }> };

/**
 * A nota inteira. As ligações dela (quem cita, o que cita) ficam em `/ligacoes`: precisam
 * de todas as notas e abrir uma nota não pode esperar por isso.
 */
export async function GET(request: Request, { params }: Contexto) {
  const semSessao = exigirSessao(request);
  if (semSessao) return semSessao;

  const id = esquemaDeIdDeNota.safeParse((await params).id);
  if (!id.success) return respostaDeErro(400, mensagemDoPrimeiroErro(id.error));

  try {
    const repositorio = await obterRepositorio();
    const nota = await repositorio.obterNota(id.data);
    if (!nota) return respostaDeErro(404, "Nota não encontrada.");

    return Response.json({ nota, capacidades: repositorio.capacidades });
  } catch (erro) {
    return tratarErroDeRepositorio(erro, "GET /api/notas/[id]");
  }
}

/**
 * Salva o que mudou (texto, pasta, tags). O título não passa por aqui: renomear
 * reescreve as ligações das outras notas e tem rota própria.
 */
export async function PATCH(request: Request, { params }: Contexto) {
  const semSessao = exigirSessao(request);
  if (semSessao) return semSessao;
  const outraOrigem = exigirMesmaOrigem(request);
  if (outraOrigem) return outraOrigem;

  const id = esquemaDeIdDeNota.safeParse((await params).id);
  if (!id.success) return respostaDeErro(400, mensagemDoPrimeiroErro(id.error));

  const corpo = await lerJsonComLimite(request);
  if (!corpo.ok) return corpo.resposta;

  const validado = esquemaDeAtualizacao.safeParse(corpo.dados);
  if (!validado.success) return respostaDeErro(400, mensagemDoPrimeiroErro(validado.error));

  const { revisaoBase, checkpoint, ...mudancas } = validado.data;
  try {
    const repositorio = await obterRepositorio();
    const resultado = await repositorio.atualizarNota(id.data, mudancas, {
      revisaoBase,
      checkpoint,
      autor: { criadoPor: "usuario" },
    });
    return respostaDeEscrita(resultado);
  } catch (erro) {
    return tratarErroDeRepositorio(erro, "PATCH /api/notas/[id]");
  }
}
