import { sql, type SQL } from "drizzle-orm";
import { descreverErro } from "../registro-de-erros";
import { automacaoWikiHabilitada } from "./configuracao";

export type TabelasDaWiki = { viva: boolean; automatica: boolean };
type Conexao = { execute(consulta: SQL): PromiseLike<unknown> };

/**
 * Uma sondagem por processo. Ligar as variáveis antes de aplicar as migrações não pode derrubar
 * a gravação das notas: sem as tabelas, a Wiki Viva fica desligada. Aplicar depois exige reiniciar,
 * como já acontece com as demais capacidades do repositório.
 */
let sondagem: Promise<TabelasDaWiki> | undefined;
let falhouEm = 0;
const DESLIGADA: TabelasDaWiki = { viva: false, automatica: false };
const ESPERA_APOS_FALHA_MS = 30_000;

/** Nunca lança: se a sondagem falhar, a wiki fica desligada por 30 s em vez de derrubar a gravação das notas. */
export function sondarTabelasDaWiki(conexao: Conexao): Promise<TabelasDaWiki> {
  if (sondagem) return sondagem;
  if (Date.now() - falhouEm < ESPERA_APOS_FALHA_MS) return Promise.resolve(DESLIGADA);
  sondagem = consultar(conexao).catch((erro: unknown) => {
    sondagem = undefined; falhouEm = Date.now();
    console.error("[wiki] Não foi possível verificar as tabelas da wiki; ela fica desligada por 30 segundos.", { erro: descreverErro(erro) });
    return DESLIGADA;
  });
  return sondagem;
}

/**
 * Faz a primeira sondagem fora de qualquer transação: uma consulta que falha dentro dela
 * aborta a transação inteira, e com ela a gravação da nota.
 */
export async function aquecerSondagemDaWiki(conexao: Conexao) {
  if (automacaoWikiHabilitada()) await sondarTabelasDaWiki(conexao);
}

async function consultar(conexao: Conexao): Promise<TabelasDaWiki> {
  const resultado = await conexao.execute(sql`select (to_regclass('public.paginas_wiki') is not null
      -- A migração 0010 acrescentou a coluna da estrutura (ligações e perguntas em aberto): sem ela, gravar e ler quebrariam.
      and exists (select 1 from information_schema.columns where table_schema = 'public'
        and table_name = 'paginas_wiki' and column_name = 'estrutura')) as viva,
    (to_regclass('public.conceitos_wiki') is not null and to_regclass('public.trabalhos_wiki') is not null
      and to_regclass('public.consumos_wiki') is not null
      -- A migração 0009 acrescentou esta coluna: com ela ausente, concluir e falhar quebrariam depois da chamada paga.
      and exists (select 1 from information_schema.columns where table_schema = 'public'
        and table_name = 'trabalhos_wiki' and column_name = 'ultimo_erro')) as automatica`);
  // postgres-js devolve as linhas; o PGlite dos testes, um objeto com `rows`.
  const linhas = (Array.isArray(resultado) ? resultado : (resultado as { rows?: unknown[] }).rows ?? []) as Partial<TabelasDaWiki>[];
  const viva = linhas[0]?.viva === true;
  return { viva, automatica: viva && linhas[0]?.automatica === true };
}

/** Automação ligada no ambiente e com as tabelas no banco. */
export async function automacaoWikiDisponivel(conexao: Conexao) {
  return automacaoWikiHabilitada() && (await sondarTabelasDaWiki(conexao)).automatica;
}

/** Só para testes: esquece a sondagem guardada. */
export function esquecerSondagemDaWiki() {
  sondagem = undefined; falhouEm = 0;
}
