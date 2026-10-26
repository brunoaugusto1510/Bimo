import ambienteNext from "@next/env";
import { setTimeout as esperar } from "node:timers/promises";

ambienteNext.loadEnvConfig(process.cwd());
const segredo = process.env.WIKI_EXECUTOR_SEGREDO?.trim();
const endereco = new URL(process.env.BIMO_URL || "http://localhost:3000");
if (!segredo || segredo.length < 32) throw new Error("Configure WIKI_EXECUTOR_SEGREDO com ao menos 32 caracteres.");
if (endereco.username || endereco.password || !["https:", "http:"].includes(endereco.protocol) ||
  endereco.protocol === "http:" && !["localhost", "127.0.0.1", "[::1]"].includes(endereco.hostname)) throw new Error("Use HTTPS para o endereço remoto do Bimo.");
const alvo = new URL("/api/wiki/processar", endereco);
const umaVez = process.argv.includes("--uma-vez");
if (process.argv.includes("--retomar")) alvo.searchParams.set("acao", "retomar");
let falhas = 0;
let ultimoTipo = "";
do {
  try {
    const resposta = await fetch(alvo, { method: "POST", redirect: "error", signal: AbortSignal.timeout(310_000),
      headers: { authorization: `Bearer ${segredo}` } });
    if ([401, 403, 503].includes(resposta.status)) {
      console.error("Executor interrompido: confira autenticação, habilitação e configuração do servidor.");
      process.exitCode = 1; break;
    }
    if (!resposta.ok) throw new Error("Falha do servidor.");
    const dados = await resposta.json();
    const tipo = ["processado", "ocioso", "orcamento", "adiado", "desligado"].includes(dados.tipo) ? dados.tipo : "resposta inesperada";
    const motivo = tipo === "adiado" && ["temporario", "revisar", "configuracao"].includes(dados.motivo) ? ` (${dados.motivo})` : "";
    console.info("[wiki]", tipo + motivo);
    if (dados.lote && dados.cobertura) {
      const contagens = { rodadas: dados.lote.rodadas, processados: dados.lote.processados, publicacoes: dados.lote.publicadas,
        lidas: dados.cobertura.concluidos, pendentes: dados.cobertura.pendentes, impedidas: dados.cobertura.impedidos };
      if (Object.values(contagens).every((n) => Number.isSafeInteger(n) && n >= 0)) console.info("[wiki] Progresso", contagens);
    }
    falhas = 0; ultimoTipo = tipo;
    alvo.searchParams.delete("acao");
  } catch {
    console.error("[wiki] Falha de comunicação. Os trabalhos permanecem na fila.");
    ultimoTipo = "";
    if (++falhas >= 5 || umaVez) { process.exitCode = 1; break; }
  }
  // Sem orçamento só há o que fazer no próximo dia UTC; consultar a cada dez segundos seria ruído.
  if (!umaVez) await esperar(ultimoTipo === "orcamento" ? 30 * 60_000 : ultimoTipo === "ocioso" ? 60_000 : 10_000);
} while (!umaVez);
