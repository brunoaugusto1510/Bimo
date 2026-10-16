import { adotarGrafiaDaPasta, dividirCaminho, juntarCaminho, normalizarPasta, validarTitulo } from "./caminho-da-nota";
import { extrairTags } from "./markdown-da-nota";
import type { NotaCompleta, RepositorioDeNotas, ResumoDeNota, ResultadoDeEscrita } from "./repositorio-de-notas/tipos";

export type FonteDeImportacao = {
  obterNotasPlanas(): Promise<{ notas: { caminho: string }[]; aviso?: string }>;
  lerConteudoDaNota(caminho: string): Promise<string | null>;
};
export type OpcoesDeImportacao = { executar: boolean; sobrescrever: boolean; pasta?: string; limite?: number };
type Situacao = "criadas" | "jaImportadas" | "divergentes" | "sobrescritas" | "ignoradas" | "colisoes" | "falhas";
export type ItemDeImportacao = { caminho: string; situacao: Situacao; motivo: string; caminhoExistente?: string };
export type RelatorioDeImportacao = {
  simulacao: boolean;
  aviso?: string;
  contagens: Record<Situacao, number>;
  itens: ItemDeImportacao[];
  codigoDeSaida: number;
};

const FLAGS = "Flags disponíveis: --executar, --pasta <caminho>, --limite <n>, --sobrescrever.";
export const AVISO_SIMULACAO = "SIMULAÇÃO — nada foi gravado. Use --executar para gravar.";
const AUTOR = { criadoPor: "usuario", ferramenta: "importar-notas" } as const;

export function interpretarArgumentos(argumentos: readonly string[]): OpcoesDeImportacao {
  let opcoes: OpcoesDeImportacao = { executar: false, sobrescrever: false };
  for (let i = 0; i < argumentos.length; i++) {
    const flag = argumentos[i];
    if (flag === "--executar") opcoes = { ...opcoes, executar: true };
    else if (flag === "--sobrescrever") opcoes = { ...opcoes, sobrescrever: true };
    else if (flag === "--pasta" || flag === "--limite") {
      const valor = argumentos[++i];
      if (!valor || valor.startsWith("--")) throw new Error(`Falta valor para ${flag}. ${FLAGS}`);
      if (flag === "--pasta") {
        const pasta = normalizarPasta(valor);
        if (!pasta || /[\u0000-\u001f\u007f]/.test(pasta)) throw new Error(`Pasta inválida. ${FLAGS}`);
        opcoes = { ...opcoes, pasta };
      } else {
        if (!/^\d+$/.test(valor) || !Number.isSafeInteger(Number(valor)) || Number(valor) < 1) {
          throw new Error(`O limite precisa ser um inteiro positivo. ${FLAGS}`);
        }
        opcoes = { ...opcoes, limite: Number(valor) };
      }
    } else throw new Error(`Argumento desconhecido. ${FLAGS}`);
  }
  return opcoes;
}

async function baixarNotas(fonte: FonteDeImportacao, caminhos: string[]) {
  const resultados = new Map<string, string | null>();
  let proximo = 0;
  await Promise.all(Array.from({ length: Math.min(8, caminhos.length) }, async () => {
    while (proximo < caminhos.length) {
      const caminho = caminhos[proximo++];
      try { resultados.set(caminho, await fonte.lerConteudoDaNota(caminho)); }
      catch { resultados.set(caminho, null); }
    }
  }));
  return resultados;
}

function caminhoDaNota(nota: Pick<ResumoDeNota, "pasta" | "titulo">): string {
  return `${juntarCaminho(nota.pasta, nota.titulo)}.md`;
}

async function descreverResultado(
  resultado: ResultadoDeEscrita,
  caminho: string,
  sucesso: "criadas" | "sobrescritas",
  repositorio: RepositorioDeNotas,
): Promise<ItemDeImportacao> {
  if (resultado.tipo === "ok") return { caminho, situacao: sucesso, motivo: sucesso === "criadas" ? "Nota criada." : "Conteúdo sobrescrito com checkpoint." };
  if (resultado.tipo === "titulo-em-uso") {
    const existente = await repositorio.obterNota(resultado.idExistente);
    return { caminho, situacao: "colisoes", motivo: "Título em uso na pasta.", caminhoExistente: existente ? caminhoDaNota(existente) : "Nota existente indisponível para leitura" };
  }
  const motivo = resultado.tipo === "conflito" ? "Conflito de revisão: a nota mudou durante a importação."
    : resultado.tipo === "nao-encontrada" ? "A nota deixou de existir durante a importação." : "O repositório recusou a escrita: somente leitura.";
  return { caminho, situacao: "falhas", motivo };
}

async function processarNota(
  caminho: string, conteudo: string, repositorio: RepositorioDeNotas,
  opcoes: OpcoesDeImportacao, existentes: ResumoDeNota[], simuladas: Map<string, NotaCompleta>,
): Promise<ItemDeImportacao> {
  const partes = dividirCaminho(caminho);
  const titulo = validarTitulo(partes.titulo);
  if (!titulo.ok) return { caminho, situacao: "ignoradas", motivo: titulo.motivo };
  const pasta = adotarGrafiaDaPasta(normalizarPasta(partes.pasta), existentes.map(nota => nota.pasta));
  if (pasta && /[\u0000-\u001f\u007f]/.test(pasta)) return { caminho, situacao: "ignoradas", motivo: "Pasta contém caracteres de controle." };
  const entrada = { titulo: titulo.titulo, pasta, conteudo, tags: extrairTags(conteudo) };
  const resumo = existentes.find(nota => nota.pasta === pasta && nota.titulo === entrada.titulo);
  if (resumo) {
    const atual = simuladas.get(resumo.id) ?? await repositorio.obterNota(resumo.id);
    if (!atual) return { caminho, situacao: "falhas", motivo: "Nota existente indisponível para leitura." };
    if (atual.conteudo === conteudo) return { caminho, situacao: "jaImportadas", motivo: "Já importada: conteúdo idêntico." };
    if (!opcoes.sobrescrever) return { caminho, situacao: "divergentes", motivo: "Conteúdo diferente; use --sobrescrever para substituir." };
    if (!opcoes.executar) return { caminho, situacao: "sobrescritas", motivo: "Seria sobrescrita com checkpoint." };
    return descreverResultado(await repositorio.atualizarNota(atual.id, { conteudo, tags: entrada.tags }, {
      revisaoBase: atual.revisao, autor: AUTOR, checkpoint: true,
    }), caminho, "sobrescritas", repositorio);
  }
  if (!opcoes.executar) {
    const colisao = existentes.find(nota => nota.pasta === pasta && nota.titulo.toLowerCase() === entrada.titulo.toLowerCase());
    if (colisao) return { caminho, situacao: "colisoes", motivo: "Título em uso na pasta.", caminhoExistente: caminhoDaNota(colisao) };
    const nota: NotaCompleta = { ...entrada, id: `simulada-${simuladas.size}`, revisao: 1, criadoEm: null, atualizadoEm: null };
    simuladas.set(nota.id, nota);
    existentes.push(nota);
    return { caminho, situacao: "criadas", motivo: "Seria criada." };
  }
  const resultado = await repositorio.criarNota(entrada, AUTOR);
  if (resultado.tipo === "ok") existentes.push(resultado.nota);
  return descreverResultado(resultado, caminho, "criadas", repositorio);
}

export async function importarNotas({ fonte, repositorio, opcoes }: {
  fonte: FonteDeImportacao; repositorio: RepositorioDeNotas; opcoes: OpcoesDeImportacao;
}): Promise<RelatorioDeImportacao> {
  const { notas, aviso } = await fonte.obterNotasPlanas();
  const pasta = normalizarPasta(opcoes.pasta);
  if (aviso && opcoes.executar && !pasta) throw new Error("Listagem incompleta: gravação recusada. Restrinja a importação com --pasta ou rode em simulação.");
  const caminhos = notas.filter(nota => /\.md$/i.test(nota.caminho))
    .filter(nota => !pasta || nota.caminho.startsWith(`${pasta}/`))
    .slice(0, opcoes.limite).map(nota => nota.caminho);
  const existentes = [...await repositorio.listarResumos()];
  const conteudos = await baixarNotas(fonte, caminhos);
  const itens: ItemDeImportacao[] = [];
  const simuladas = new Map<string, NotaCompleta>();
  // A ordem estável faz colisões entre notas da origem terem o mesmo resultado na simulação e na execução.
  for (const caminho of caminhos) {
    const conteudo = conteudos.get(caminho);
    if (conteudo === null || conteudo === undefined) {
      itens.push({ caminho, situacao: "falhas", motivo: "Não foi possível baixar o conteúdo da nota." });
      continue;
    }
    try { itens.push(await processarNota(caminho, conteudo, repositorio, opcoes, existentes, simuladas)); }
    catch { itens.push({ caminho, situacao: "falhas", motivo: "Falha ao consultar ou gravar a nota no banco." }); }
  }
  const contagens: Record<Situacao, number> = { criadas: 0, jaImportadas: 0, divergentes: 0, sobrescritas: 0, ignoradas: 0, colisoes: 0, falhas: 0 };
  for (const item of itens) contagens[item.situacao]++;
  return { simulacao: !opcoes.executar, aviso, contagens, itens, codigoDeSaida: contagens.falhas + contagens.colisoes > 0 ? 1 : 0 };
}

export function formatarRelatorio(relatorio: RelatorioDeImportacao, incluirAvisosDeSimulacao = true): string {
  const c = relatorio.contagens;
  return [
    ...(relatorio.simulacao ? (incluirAvisosDeSimulacao ? [AVISO_SIMULACAO] : []) : ["IMPORTAÇÃO — gravação habilitada."]),
    ...(relatorio.aviso ? [`Aviso: ${relatorio.aviso}`] : []),
    `Criadas: ${c.criadas}; já importadas: ${c.jaImportadas}; divergentes: ${c.divergentes}; sobrescritas: ${c.sobrescritas}; ignoradas: ${c.ignoradas}; colisões: ${c.colisoes}; falhas: ${c.falhas}.`,
    ...(relatorio.simulacao ? ["As contagens de criação e sobrescrita indicam o que seria feito."] : []),
    ...relatorio.itens.map(item => `${item.caminho}: ${item.motivo}${item.caminhoExistente ? ` Colide com: ${item.caminhoExistente}.` : ""}`),
    "Datas de criação/edição das notas criadas serão as da importação; datas históricas do GitHub não são consultadas.",
    ...(relatorio.simulacao && incluirAvisosDeSimulacao ? [AVISO_SIMULACAO] : []),
  ].join("\n");
}
