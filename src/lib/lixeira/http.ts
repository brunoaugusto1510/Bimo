import { z } from "zod";
import { exigirSessao } from "../autenticacao";
import { obterRepositorio } from "../repositorio-de-notas";
import { esquemaDeIdDeNota, mensagemDoPrimeiroErro } from "../validacao-de-notas";
import { exigirMesmaOrigem, lerJsonComLimite, respostaDeErro, respostaDeEscrita, tratarErroDeRepositorio } from "../http-de-notas";
import { agendarManutencaoWiki } from "../wiki/agendar";

const esquema = z.object({ revisaoBase: z.number().int().min(1).max(2147483646) }).strict();
export async function alterarLixeira(request: Request, idBruto: string, restaurar: boolean) {
  const semSessao = exigirSessao(request); if (semSessao) return semSessao;
  const outraOrigem = exigirMesmaOrigem(request); if (outraOrigem) return outraOrigem;
  const id = esquemaDeIdDeNota.safeParse(idBruto);
  if (!id.success) return respostaDeErro(400, mensagemDoPrimeiroErro(id.error));
  const corpo = await lerJsonComLimite(request); if (!corpo.ok) return corpo.resposta;
  const validado = esquema.safeParse(corpo.dados);
  if (!validado.success) return respostaDeErro(400, mensagemDoPrimeiroErro(validado.error));
  try {
    const repo = await obterRepositorio();
    if (!repo.capacidades.escrita) return respostaDeErro(403, "As notas estão em modo somente leitura.", { tipo: "somente-leitura" });
    const resultado = await (restaurar ? repo.restaurarNota(id.data, validado.data.revisaoBase) : repo.moverParaLixeira(id.data, validado.data.revisaoBase));
    if (resultado.tipo === "ok") agendarManutencaoWiki();
    return respostaDeEscrita(resultado);
  } catch (erro) { return tratarErroDeRepositorio(erro, "POST /api/notas/[id]/lixeira"); }
}
