import { normalizarTexto } from "../caminho-da-nota";
import type { RepositorioDeNotas, ResumoDeNota } from "../repositorio-de-notas/tipos";
import type { ConceitoWiki } from "./automacao-tipos";
import type { AlertaWiki, EstadoDoNeuronio } from "./observabilidade-tipos";
import { compactarFontes, hashDoConteudo } from "./fontes";
import { ordenarTermos } from "./recuperacao";
import { exigirWiki } from "./servico";
import type { MetadadosWiki } from "./tipos";

export function estadoDoNeuronio(meta: MetadadosWiki, conceito: ConceitoWiki | undefined, notas: Map<string, ResumoDeNota>): EstadoDoNeuronio {
  if (conceito?.pausada) return "em_pausa";
  const nota = notas.get(meta.notaId);
  if (conceito?.protegida || nota?.revisao !== (conceito?.revisaoGerenciada ?? meta.revisaoPublicada)) return "seu";
  if (!meta.fontes.some((f) => notas.has(f.id))) return "sem_raizes";
  if (meta.estrutura.divergencias?.length) return "em_tensao";
  if (meta.fontes.some((f) => !notas.has(f.id) || notas.get(f.id)!.revisao !== (conceito?.origens[f.id] ?? f.revisao))) return "reconsolidando";
  return "vivo";
}

/** Dados comuns às telas, sem depender de layout e sem enviar cópias completas das origens. */
export async function obterCerebroWiki(repo: RepositorioDeNotas, teto: number) {
  const wiki = exigirWiki(repo);
  const [paginas, conceitos, resumos, cobertura, energia] = await Promise.all([
    wiki.listar(), wiki.automacao?.conceitos() ?? [], repo.listarResumos(), wiki.automacao?.cobertura(), wiki.automacao?.energia(teto),
  ]);
  const notas = new Map(resumos.map((n) => [n.id, n])); const porId = new Map(conceitos.map((c) => [c.notaId, c]));
  const neuronios = paginas.flatMap((p) => {
    const nota = notas.get(p.notaId); if (!nota) return [];
    const conceito = porId.get(p.notaId);
    return [{ ...nota, estado: estadoDoNeuronio(p, conceito, notas), alertas: conceito?.diagnostico?.alertas ?? [],
      afirmacoes: p.afirmacoes, fontes: p.fontes.map((f) => "conteudo" in f ? compactarFontes([f], p.afirmacoes)[0] : f), estrutura: p.estrutura }];
  });
  return { resumo: { neuronios: neuronios.length, sinapses: neuronios.reduce((s, n) => s + n.afirmacoes.reduce((t, a) => t + a.evidencias.length, 0), 0),
    notasLidas: cobertura?.concluidos ?? 0, totalDeNotas: cobertura?.elegiveis ?? resumos.length - neuronios.length,
    emConsolidacao: cobertura?.pendentes ?? 0, impedidas: cobertura?.impedidos ?? 0 }, energia: energia ?? null, neuronios, cobertura };
}

/** Verificação local em lotes, no máximo uma vez por dia por síntese; não chama o modelo. */
export async function verificarSinteses(repo: RepositorioDeNotas, limite = 20) {
  const fila = repo.wiki?.automacao; if (!fila) return 0;
  const [paginas, conceitos, resumos] = await Promise.all([repo.wiki!.listar(), fila.conceitos(), repo.listarResumos()]);
  const notas = new Map(resumos.map((n) => [n.id, n])); const porId = new Map(conceitos.map((c) => [c.notaId, c]));
  const derivadas = new Set(paginas.map((p) => p.notaId));
  const identidades = new Map<string, Set<string>>();
  for (const c of conceitos) for (const texto of [notas.get(c.notaId)?.titulo ?? c.chave, ...c.aliases]) {
    // Ordenar palavras também encontra títulos que só trocaram a ordem, sem fundir conceitos automaticamente.
    const chave = normalizarTexto(texto).match(/[\p{L}\p{N}]+/gu)?.sort().join(" ");
    if (!chave) continue;
    const ids = identidades.get(chave) ?? new Set<string>(); ids.add(c.notaId); identidades.set(chave, ids);
  }
  const duplicadas = new Set([...identidades.values()].filter((ids) => ids.size > 1).flatMap((ids) => [...ids]));
  const agora = new Date();
  const candidatas = paginas.filter((p) => notas.has(p.notaId) && porId.has(p.notaId))
    .sort((a, b) => (porId.get(a.notaId)?.diagnostico?.verificadoEm ?? "").localeCompare(porId.get(b.notaId)?.diagnostico?.verificadoEm ?? ""))
    .filter((p) => agora.getTime() - Date.parse(porId.get(p.notaId)?.diagnostico?.verificadoEm ?? "1970-01-01") >= 86_400_000)
    .slice(0, Math.max(1, Math.min(limite, 50)));
  for (const p of candidatas) {
    const c = porId.get(p.notaId)!; const alertas: AlertaWiki[] = [];
    if (!p.fontes.some((f) => notas.has(f.id))) alertas.push("sem_raizes");
    if (p.estrutura.divergencias?.length) alertas.push("divergencias");
    if (duplicadas.has(p.notaId)) alertas.push("duplicata");
    if (c.protegida) {
      const relacionadas = new Set<string>();
      for (const { termo } of ordenarTermos(notas.get(p.notaId)!.titulo, c.aliases.join(" ")).slice(0, 3)) {
        for (const id of await repo.buscarIdsPorConteudo(termo, 30)) relacionadas.add(id);
      }
      if ([...relacionadas].some((id) => !derivadas.has(id) && notas.has(id) && c.origens[id] !== notas.get(id)!.revisao)) alertas.push("protegida_com_novidades");
    }
    if (p.estrutura.ligacoes.some((id) => !derivadas.has(id) || !notas.has(id))) alertas.push("ligacao_quebrada");
    await fila.registrarDiagnostico(p.notaId, notas.get(p.notaId)!.revisao, {
      assinatura: hashDoConteudo(JSON.stringify(alertas)), alertas, verificadoEm: agora.toISOString(),
    });
  }
  return candidatas.length;
}
