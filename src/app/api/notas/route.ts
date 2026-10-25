import { exigirSessao } from "@/lib/autenticacao";
import { agendarManutencaoWiki } from "@/lib/wiki/agendar";
import {
  exigirMesmaOrigem,
  lerJsonComLimite,
  respostaDeErro,
  respostaDeEscrita,
  tratarErroDeRepositorio,
} from "@/lib/http-de-notas";
import { obterRepositorio } from "@/lib/repositorio-de-notas";
import { esquemaDeCriacao, mensagemDoPrimeiroErro } from "@/lib/validacao-de-notas";

/** Lista as notas (só os resumos): é o que a paleta "Ir para nota" e as abas usam. */
export async function GET(request: Request) {
  // Mesma checagem do `proxy.ts`, repetida de propósito: o proxy é a cerca, não a única tranca.
  const semSessao = exigirSessao(request);
  if (semSessao) return semSessao;

  try {
    const repositorio = await obterRepositorio();
    return Response.json({ notas: await repositorio.listarResumos(), capacidades: repositorio.capacidades });
  } catch (erro) {
    return tratarErroDeRepositorio(erro, "GET /api/notas");
  }
}

export async function POST(request: Request) {
  const semSessao = exigirSessao(request);
  if (semSessao) return semSessao;
  const outraOrigem = exigirMesmaOrigem(request);
  if (outraOrigem) return outraOrigem;

  const corpo = await lerJsonComLimite(request);
  if (!corpo.ok) return corpo.resposta;

  const validado = esquemaDeCriacao.safeParse(corpo.dados);
  if (!validado.success) return respostaDeErro(400, mensagemDoPrimeiroErro(validado.error));

  try {
    const repositorio = await obterRepositorio();
    const resultado = await repositorio.criarNota(validado.data, { criadoPor: "usuario" });
    if (resultado.tipo === "ok") agendarManutencaoWiki();
    return respostaDeEscrita(resultado, 201);
  } catch (erro) {
    return tratarErroDeRepositorio(erro, "POST /api/notas");
  }
}
