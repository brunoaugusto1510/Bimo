import { after } from "next/server";
import { descreverErro } from "../registro-de-erros";
import { automacaoWikiHabilitada, tetoDiarioWiki } from "./configuracao";

/** Cada rodada reconcilia e reivindica em transações; um autosave por pausa não pode disparar uma a cada vez. */
const INTERVALO_MINIMO_MS = 30_000;
let ultimaRodada = 0;
let emAndamento = false;

/** Só para testes: esquece o estado do limitador. */
export function esquecerRodadasDaWiki() {
  ultimaRodada = 0; emAndamento = false;
}

/**
 * Acelera a fila após atividade; o executor independente garante retomada sem navegador.
 * No máximo uma rodada por vez e uma a cada 30 segundos por processo.
 */
export function agendarManutencaoWiki() {
  if (!automacaoWikiHabilitada() || !process.env.OPENAI_API_KEY?.trim()) return;
  const agora = Date.now();
  if (emAndamento || agora - ultimaRodada < INTERVALO_MINIMO_MS) return;
  ultimaRodada = agora; emAndamento = true;
  try {
    after(async () => {
      try {
        const [{ obterRepositorio }, { gerarConhecimentoWiki }, { processarWiki }] = await Promise.all([
          import("../repositorio-de-notas"), import("./gerador"), import("./automacao"),
        ]);
        await processarWiki(await obterRepositorio(), gerarConhecimentoWiki, { tetoDiario: tetoDiarioWiki() });
      }
      catch (erro) { console.error("[wiki] Não foi possível executar a manutenção. Os trabalhos permanecem persistidos.", { erro: descreverErro(erro) }); }
      finally { emAndamento = false; }
    });
  } catch {
    // Sem contexto HTTP (por exemplo, execução interna); a fila durável permanece pendente.
    ultimaRodada = 0; emAndamento = false;
  }
}
