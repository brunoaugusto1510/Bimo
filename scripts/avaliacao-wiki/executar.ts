import { writeFile, readFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { criarRepositorioEmMemoria } from "../../src/lib/repositorio-de-notas/memoria";
import { processarWiki } from "../../src/lib/wiki/automacao";
import { gerarConhecimentoWiki } from "../../src/lib/wiki/gerador";
import { casos } from "./casos";
import type { ContextoWiki } from "../../src/lib/wiki/automacao-tipos";
import { ErroDaGeracaoWiki } from "../../src/lib/wiki/tipos";
import { POLITICA_EDITORIAL } from "../../src/lib/wiki/editorial";
import { consultarConhecimentoWiki } from "../../src/lib/wiki/consulta";
import { consultas } from "./consultas";
import type { RepositorioDeNotas } from "../../src/lib/repositorio-de-notas/tipos";

declare const POLITICA_DA_AVALIACAO: string;
declare const BASE_DA_AVALIACAO: string;
const reproduzir = process.argv.includes("--reproduzir");
if (!process.argv.includes("--executar") && !reproduzir) throw new Error("Escolha executar ou reproduzir.");
const pasta = ".vercel/avaliacao-editorial";
await mkdir(pasta, { recursive: true });
const caminho = `${pasta}/${POLITICA_DA_AVALIACAO}${reproduzir ? "-recuperacao" : ""}.json`;
const originais = reproduzir ? JSON.parse(await readFile(`${pasta}/${POLITICA_DA_AVALIACAO}.json`, "utf8")) as { id: string; geracao: unknown }[] : [];
if (originais.some((r) => r.geracao && typeof r.geracao === "object" && "politica" in r.geracao && r.geracao.politica !== POLITICA_EDITORIAL)) {
  throw new Error("A reprodução exige a revisão do código compatível com a política registrada. Nenhum caso foi regravado.");
}
const anteriores = await readFile(caminho, "utf8").then(JSON.parse).catch(() => []) as { id: string; uso?: { entrada: number; saida: number } | null; comprometido?: number }[];
const selecionados = process.env.CASOS_WIKI?.split(",");
const autor = { criadoPor: "usuario" as const };
const hashDoExecutor = createHash("sha256").update(await readFile(process.argv[1])).digest("hex");
const reservaPorChamada = 32_000;
const transporte = globalThis.fetch;
globalThis.fetch = (entrada, opcoes) => {
  if (reproduzir || String(entrada) !== "https://api.openai.com/v1/responses" || typeof opcoes?.body !== "string"
    || Buffer.byteLength(opcoes.body, "utf8") + 4096 > reservaPorChamada) {
    throw new Error("Pedido fora dos limites da amostra; não enviado ao provedor.");
  }
  return transporte(entrada, opcoes);
};
const agora = Date.now;
let relogio = agora();
Date.now = () => relogio;
async function verificarRecuperacao(repo: RepositorioDeNotas, id: string) {
  return Promise.all((consultas[id] ?? []).map(async (consulta) => {
    const acertos = await repo.buscarPorConteudo(consulta, 10);
    return { consulta, acertos, wiki: await consultarConhecimentoWiki(repo, consulta, acertos.map((v) => v.id)) };
  }));
}
try {
  for (const caso of casos) {
    if (selecionados && !selecionados.includes(caso.id) || anteriores.some((v) => v.id === caso.id)) continue;
    let chamadasDoCaso = 0;
    // Limite da avaliação, sem alterar qualquer configuração de execução da aplicação.
    const reserva = reservaPorChamada;
    if (!reproduzir && anteriores.reduce((n, v) => n + (v.comprometido ?? (v.uso ? v.uso.entrada + v.uso.saida : v.id === "15" ? 0 : reserva)), 0) + reserva > 100_000) throw new Error("Saldo da avaliação não comporta outra reserva; nenhuma chamada adicional iniciada.");
    const repo = criarRepositorioEmMemoria([]);
    if (caso.semente) {
      await repo.criarNota({ titulo: "Origem anterior", conteudo: caso.semente.texto }, autor);
      relogio += 91_000;
      await processarWiki(repo, async (c) => ({ proposta: { propostas: [{ titulo: caso.semente!.titulo, alvoId: null, aliases: caso.semente!.aliases ?? [],
        afirmacoes: [{ texto: caso.semente!.texto, natureza: "explicita", evidencias: [{ fonteId: c.origem.id, citacao: caso.semente!.texto }] }], lacunas: caso.semente!.lacunas ?? [] }] }, uso: { entrada: 0, saida: 0 } }), { tetoDiario: 1_000_000 });
      const [pagina] = await repo.wiki!.listar();
      if (!pagina) throw new Error("Falha na preparação da amostra sintética.");
      if (caso.semente.protegida) await repo.atualizarNota(pagina.notaId, { conteudo: `${(await repo.obterNota(pagina.notaId))!.conteudo}\nTexto humano.` }, { revisaoBase: 1, autor });
      if (caso.semente.pausada) await repo.wiki!.automacao!.pausar(pagina.notaId, 1, true);
    }
    if (caso.id === "15") {
      const antes = await repo.wiki!.listar();
      const resultado = await processarWiki(repo, async () => { throw new Error("Uma entrada concluída não deve gerar novamente."); }, { tetoDiario: 1_000_000 });
      anteriores.push({ id: caso.id, uso: null, ...{ esperado: caso.esperado, resultado, antes, depois: await repo.wiki!.listar(), origemPreservada: true,
        recuperacao: await verificarRecuperacao(repo, caso.id) } });
      await writeFile(caminho, JSON.stringify(anteriores, null, 2));
      console.info("[avaliação] Idempotência conferida", { politica: POLITICA_DA_AVALIACAO, caso: caso.id, resultado });
      continue;
    }
    const criacao = await repo.criarNota({ titulo: `Entrada sintética ${caso.id}`, conteudo: caso.texto }, autor);
    if (criacao.tipo !== "ok") throw new Error("Falha ao preparar entrada.");
    const antes = await repo.wiki!.listar();
    relogio += 91_000;
    let geracao: unknown = null;
    let uso: { entrada: number; saida: number } | null = null;
    let contexto: unknown = null;
    let comprometido = reserva;
    const resultado = await processarWiki(repo, async (c) => {
      // Esta amostra histórica mede uma geração por caso; continuação exige outro protocolo e orçamento.
      if (++chamadasDoCaso > 1) throw new ErroDaGeracaoWiki("A amostra não permite uma segunda chamada neste caso.", { entrada: 0, saida: 0 });
      const entrada: ContextoWiki = caso.soIndice ? { ...c, candidatas: [] } : c;
      contexto = entrada;
      try {
        const original = originais.find((v) => v.id === caso.id);
        if (reproduzir && !original?.geracao) throw new Error("Resultado original ausente para reprodução.");
        const r = reproduzir ? { proposta: original!.geracao, uso: { entrada: 0, saida: 0 } } : await gerarConhecimentoWiki(entrada, AbortSignal.timeout(60_000));
        geracao = r.proposta; uso = r.uso;
        if (uso) comprometido = uso.entrada + uso.saida;
        return r;
      } catch (erro) {
        if (erro instanceof ErroDaGeracaoWiki && erro.uso) { uso = erro.uso; comprometido = uso.entrada + uso.saida; }
        throw erro;
      }
    }, { tetoDiario: 1_000_000 });
    const depois = await repo.wiki!.listar();
    const origemPreservada = (await repo.obterNota(criacao.nota.id))!.conteudo === caso.texto;
    const diario = await repo.wiki!.automacao!.diario({ inicio: "2020-01-01T00:00:00Z", fim: "2100-01-01T00:00:00Z" });
    const registro = { id: caso.id, esperado: caso.esperado, base: BASE_DA_AVALIACAO, hashDoExecutor,
      hashDoCaso: createHash("sha256").update(JSON.stringify(caso)).digest("hex"),
      modelo: process.env.OPENAI_MODEL?.trim() || "gpt-6-luna", contexto, geracao, uso, comprometido, resultado, antes, depois, origemPreservada, diario,
      recuperacao: await verificarRecuperacao(repo, caso.id) };
    anteriores.push(registro);
    await writeFile(caminho, JSON.stringify(anteriores, null, 2));
    console.info("[avaliação] Caso concluído", { politica: POLITICA_DA_AVALIACAO, caso: caso.id, resultado, uso });
  }
} finally { Date.now = agora; globalThis.fetch = transporte; }
