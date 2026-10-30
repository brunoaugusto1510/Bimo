import { identidadeDoTema } from "./identidade";
import type { RepositorioDeNotas, ResumoDeNota } from "../repositorio-de-notas/tipos";
import type { ConceitoWiki } from "./automacao-tipos";
import { pedeAtencao, type AlertaWiki, type EstadoDoNeuronio } from "./observabilidade-tipos";
import { compactarFontes, hashDoConteudo } from "./fontes";
import { ordenarTermos } from "./recuperacao";
import { exigirWiki } from "./servico";
import type { MetadadosWiki } from "./tipos";

/** Uma consolidação explícita deixa o caminho antigo legível, mas ele não é outro tema a manter no cérebro. */
const consolidada = (p: MetadadosWiki) => p.estrutura.manutencao?.tipo === "consolidacao_autorizada" && Boolean(p.estrutura.manutencao.consolidadaEm);

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
/** `teto` nulo (configuração inválida) deixa só a energia indisponível: o resto do cérebro continua legível. */
export async function obterCerebroWiki(repo: RepositorioDeNotas, teto: number | null) {
  const wiki = exigirWiki(repo);
  const [paginas, conceitos, resumos, cobertura, energia] = await Promise.all([
    wiki.listar(), wiki.automacao?.conceitos() ?? [], repo.listarResumos(), wiki.automacao?.cobertura(), teto === null ? undefined : wiki.automacao?.energia(teto),
  ]);
  const notas = new Map(resumos.map((n) => [n.id, n])); const porId = new Map(conceitos.map((c) => [c.notaId, c]));
  const neuronios = paginas.filter((p) => !consolidada(p)).flatMap((p) => {
    const nota = notas.get(p.notaId); if (!nota) return [];
    const conceito = porId.get(p.notaId);
    return [{ ...nota, estado: estadoDoNeuronio(p, conceito, notas), alertas: conceito?.diagnostico?.alertas ?? [],
      afirmacoes: p.afirmacoes, fontes: p.fontes.map((f) => "conteudo" in f ? compactarFontes([f], p.afirmacoes)[0] : f), estrutura: p.estrutura }];
  });
  return { resumo: { neuronios: neuronios.length, sinapses: neuronios.reduce((s, n) => s + n.afirmacoes.reduce((t, a) => t + a.evidencias.length, 0), 0),
    notasLidas: cobertura?.concluidos ?? 0, totalDeNotas: cobertura?.elegiveis ?? resumos.length - neuronios.length,
    emConsolidacao: cobertura?.pendentes ?? 0, impedidas: cobertura?.impedidos ?? 0 }, energia: energia ?? null, neuronios, cobertura };
}

/** Releituras pedidas por verificação para ligar neurônios isolados; cada uma custa uma leitura paga da origem. */
const RELEITURAS_POR_VERIFICACAO = 2;

/** Verificação local em lotes, no máximo uma vez por dia por síntese; não chama o modelo (só reenfileira origens). */
export async function verificarSinteses(repo: RepositorioDeNotas, limite = 20) {
  const fila = repo.wiki?.automacao; if (!fila) return 0;
  const [publicadas, conceitos, resumos] = await Promise.all([repo.wiki!.listar(), fila.conceitos(), repo.listarResumos()]);
  const paginas = publicadas.filter((p) => !consolidada(p));
  const notas = new Map(resumos.map((n) => [n.id, n])); const porId = new Map(conceitos.map((c) => [c.notaId, c]));
  // Redirecionamentos continuam sendo páginas derivadas e destinos legíveis, mesmo fora da manutenção ativa.
  const derivadas = new Set(publicadas.map((p) => p.notaId));
  const ativas = new Set(paginas.map((p) => p.notaId));
  const identidades = new Map<string, Set<string>>();
  for (const c of conceitos.filter((c) => ativas.has(c.notaId))) for (const texto of [notas.get(c.notaId)?.titulo ?? c.chave, ...c.aliases]) {
    // Ordenar palavras também encontra títulos que só trocaram a ordem, sem fundir conceitos automaticamente.
    const chave = identidadeDoTema(texto).match(/[\p{L}\p{N}]+/gu)?.sort().join(" ");
    if (!chave) continue;
    const ids = identidades.get(chave) ?? new Set<string>(); ids.add(c.notaId); identidades.set(chave, ids);
  }
  const duplicadas = new Set([...identidades.values()].filter((ids) => ids.size > 1).flatMap((ids) => [...ids]));
  // Quem é citado por outro neurônio não está isolado, mesmo sem ligações próprias.
  const citadas = new Set(paginas.flatMap((p) => p.estrutura.ligacoes.filter((id) => id !== p.notaId)));
  const relidas = new Set<string>();
  let ociosa: boolean | undefined;
  const filaOciosa = async () => (ociosa ??= (await fila.cobertura()).pendentes === 0);
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
    const isolado = paginas.length > 1 && !p.estrutura.ligacoes.length && !citadas.has(p.notaId);
    if (isolado) alertas.push("isolado");
    // O lint também corrige: um neurônio isolado tem a origem relida uma vez, já com o índice e os vizinhos atuais, para
    // ganhar ligações. Só quem já estava isolado na verificação anterior (um dia antes), com a fila ociosa (notas novas vêm
    // antes) e uma vez por isolamento: um neurônio que nasce de uma releitura espera um dia, o que impede uma cascata de
    // releituras pagas. Continuar isolado não gera outra; voltar a ter ligações zera a tentativa.
    let religacao = isolado ? c.diagnostico?.religacao : undefined;
    if (isolado && c.diagnostico?.alertas.includes("isolado") && !religacao && !c.protegida && !c.pausada) {
      const origem = p.fontes.map((f) => notas.get(f.id)).find((n) => n && !derivadas.has(n.id));
      // Um irmão da mesma origem já relida nesta verificação conta como tentado: a releitura serve aos dois.
      if (origem && relidas.has(origem.id)) religacao = agora.toISOString();
      else if (origem && relidas.size < RELEITURAS_POR_VERIFICACAO && await filaOciosa()
        && (await fila.reprocessar(origem.id, origem.revisao)) === "ok") {
        relidas.add(origem.id); religacao = agora.toISOString();
      }
    }
    await fila.registrarDiagnostico(p.notaId, notas.get(p.notaId)!.revisao, {
      // A assinatura decide se o Diário ganha um evento: só os alertas que pedem atenção contam (entrar ou sair de "isolado" não repete o aviso).
      assinatura: hashDoConteudo(JSON.stringify(alertas.filter(pedeAtencao))), alertas, verificadoEm: agora.toISOString(), ...(religacao ? { religacao } : {}),
    });
  }
  return candidatas.length;
}
