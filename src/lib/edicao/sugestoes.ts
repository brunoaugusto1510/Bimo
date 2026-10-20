import { buscarPorTitulo, type Intervalo, type NotaParaBusca } from "../busca-por-titulo";
import type { Resolvedor } from "../ligacoes";
import { COMANDOS, aplicarComando, type IdDoComando } from "./comandos-do-editor";
import type { Gatilho } from "./gatilho-do-editor";
import { planejarInsercaoDeLigacao, type Edicao } from "./insercao-no-editor";
import { sugerirLigacoes, type SugestaoDeLigacao } from "./sugestoes-de-ligacao";

/** Comandos que não formatam o texto, mas pedem algo ao Bimo: o `/continuar` só apaga o que foi digitado e dispara o pedido. */
export type IdDoComandoDoBimo = "bimo-continuar";
const COMANDOS_DO_BIMO: readonly { id: IdDoComandoDoBimo; titulo: string; detalhe: string }[] = [
  { id: "bimo-continuar", titulo: "Bimo: continuar o texto", detalhe: "✦" },
];

/** Uma opção de qualquer das três listas do editor: ligação (`[[`), tag (`#`) ou comando (`/`). */
export type Sugestao =
  | ({ tipo: "ligacao" } & SugestaoDeLigacao)
  | { tipo: "tag"; id: string; intervalos: Intervalo[] }
  | { tipo: "comando"; id: IdDoComando | IdDoComandoDoBimo; titulo: string; detalhe: string; intervalos: Intervalo[] };

type SugestaoDeTag = Extract<Sugestao, { tipo: "tag" }>;
type SugestaoDeComando = Extract<Sugestao, { tipo: "comando" }>;

/** O que a lista mostra de uma opção, igual para os três tipos. */
export type ItemDaLista = {
  id: string;
  titulo: string;
  detalhe: string | null;
  /** O detalhe é só enfeite (a sintaxe do comando): quem usa leitor de tela não precisa ouvi-lo. */
  detalheDecorativo: boolean;
  /** O nome acessível: começa pelo texto visível (Label in Name). */
  rotulo: string;
  intervalos: Intervalo[];
};

const LIMITE_PADRAO = 8;

/** Tags da nota primeiro, depois as das outras; sem repetir (maiúsculas não contam) e sem as que têm espaço (no texto virariam outra tag). */
export function sugerirTags({ nomes, daNota, consulta, limite = LIMITE_PADRAO }: { nomes: readonly string[]; daNota: readonly string[]; consulta: string; limite?: number }): SugestaoDeTag[] {
  const vistas = new Set<string>();
  const candidatas: NotaParaBusca[] = [];
  for (const nome of [...daNota, ...nomes]) {
    const chave = nome.toLowerCase();
    if (/\s/.test(nome) || vistas.has(chave)) continue;
    vistas.add(chave);
    candidatas.push({ id: nome, titulo: nome, pasta: null });
  }
  // As tags da própria nota entram como "recentes": em empate de relevância, vêm primeiro.
  const resultado = buscarPorTitulo(candidatas, consulta, daNota, limite).map(({ nota, intervalos }): SugestaoDeTag => ({ tipo: "tag", id: nota.id, intervalos }));
  // A única opção já é o que foi digitado (`#ideia` inteiro): a lista só atrapalharia, e o Enter seguinte é quebra de linha.
  return resultado.length === 1 && resultado[0].id.toLowerCase() === consulta.toLowerCase() ? [] : resultado;
}

/** Sem consulta, todos na ordem do menu; com ela, os que combinam, do melhor para o pior. `comBimo` inclui os comandos do Bimo. */
export function sugerirComandos(consulta: string, comBimo = false): SugestaoDeComando[] {
  const todos: readonly { id: IdDoComando | IdDoComandoDoBimo; titulo: string; detalhe: string }[] = comBimo ? [...COMANDOS, ...COMANDOS_DO_BIMO] : COMANDOS;
  const comoSugestao = (comando: (typeof todos)[number], intervalos: Intervalo[]): SugestaoDeComando => ({ tipo: "comando", id: comando.id, titulo: comando.titulo, detalhe: comando.detalhe, intervalos });
  if (!consulta.trim()) return todos.map((comando) => comoSugestao(comando, []));
  const notas = todos.map((comando): NotaParaBusca => ({ id: comando.id, titulo: comando.titulo, pasta: null }));
  return buscarPorTitulo(notas, consulta, [], todos.length).flatMap(({ nota, intervalos }) => {
    const comando = todos.find((candidato) => candidato.id === nota.id);
    return comando ? [comoSugestao(comando, intervalos)] : [];
  });
}

export type ContextoDasSugestoes = {
  notas: readonly NotaParaBusca[];
  idAtual: string;
  pastaAtual: string | null;
  resolver: Resolvedor;
  /** Os nomes das tags em uso nas notas (do servidor). */
  tagsDasNotas: readonly string[];
  /** As tags da coluna da nota aberta. */
  tagsDaNota: readonly string[];
  /** O editor tem o "Bimo sugere": o menu `/` inclui `/continuar`. */
  comBimo?: boolean;
};

/** A lista certa para o que a pessoa está digitando. */
export function sugerirParaGatilho(gatilho: Gatilho, contexto: ContextoDasSugestoes): Sugestao[] {
  if (gatilho.tipo === "tag") return sugerirTags({ nomes: contexto.tagsDasNotas, daNota: contexto.tagsDaNota, consulta: gatilho.consulta });
  if (gatilho.tipo === "comando") return sugerirComandos(gatilho.consulta, contexto.comBimo);
  const { notas, idAtual, pastaAtual, resolver } = contexto;
  return sugerirLigacoes({ notas, consulta: gatilho.consulta, idAtual, pastaAtual, resolver }).map((sugestao) => ({ tipo: "ligacao", ...sugestao }));
}

export function paraItemDaLista(sugestao: Sugestao): ItemDaLista {
  if (sugestao.tipo === "tag") {
    const titulo = `#${sugestao.id}`;
    // O `#` entra antes do nome: o destaque anda uma casa.
    return { id: sugestao.id, titulo, detalhe: null, detalheDecorativo: false, rotulo: titulo, intervalos: sugestao.intervalos.map(([inicio, fim]): Intervalo => [inicio + 1, fim + 1]) };
  }
  if (sugestao.tipo === "comando") {
    // O "2×2" fica fora do que o leitor de tela lê (é enfeite), então o tamanho da tabela vai no nome.
    const rotulo = sugestao.id === "tabela" ? `${sugestao.titulo}, 2 por 2` : sugestao.titulo;
    return { id: sugestao.id, titulo: sugestao.titulo, detalhe: sugestao.detalhe, detalheDecorativo: true, rotulo, intervalos: sugestao.intervalos };
  }
  return {
    id: sugestao.id, titulo: sugestao.titulo, detalhe: sugestao.pasta, detalheDecorativo: false,
    rotulo: sugestao.pasta ? `${sugestao.titulo}, na pasta ${sugestao.pasta}` : sugestao.titulo, intervalos: sugestao.intervalos,
  };
}

export function rotuloDaLista(tipo: Gatilho["tipo"]): string {
  return tipo === "tag" ? "Tags" : tipo === "comando" ? "Comandos de formatação" : "Notas para ligar";
}

export function avisoDeAbertura(tipo: Gatilho["tipo"], quantidade: number): string {
  if (tipo === "comando") return `${quantidade} ${quantidade === 1 ? "comando" : "comandos"}. Setas escolhem, Enter aplica, Esc fecha.`;
  // Numa tag, Enter só insere depois das setas (senão trocaria o que foi digitado por uma sugestão aproximada).
  if (tipo === "tag") return `${quantidade} ${quantidade === 1 ? "tag sugerida" : "tags sugeridas"}. Setas escolhem, Enter insere a escolhida, Esc fecha.`;
  return `${quantidade} ${quantidade === 1 ? "nota sugerida" : "notas sugeridas"}. Setas escolhem, Enter insere, Esc fecha.`;
}

/** Os comandos de bloco dizem onde o cursor ficou: quem usa leitor de tela não vê a cerca, a tabela ou o divisor. */
const AVISO_DO_COMANDO: Partial<Record<IdDoComando | IdDoComandoDoBimo, string>> = {
  "bimo-continuar": "Pedido enviado ao Bimo.",
  codigo: "Bloco de código inserido. Cursor dentro do bloco.",
  divisor: "Divisor inserido. Cursor na linha seguinte.",
  tabela: "Tabela 2 por 2 inserida. Cabeçalho da primeira coluna selecionado.",
};

export function avisoDeInsercao(sugestao: Sugestao): string {
  if (sugestao.tipo === "tag") return `Tag #${sugestao.id} inserida`;
  if (sugestao.tipo === "comando") return AVISO_DO_COMANDO[sugestao.id] ?? `Aplicado: ${sugestao.titulo}`;
  return `Ligação inserida: «${sugestao.titulo}»`;
}

/** A troca de texto que a opção escolhida faz, a partir do gatilho que abriu a lista e da posição do cursor. */
export function planejarInsercao(texto: string, gatilho: Gatilho, cursor: number, sugestao: Sugestao): Edicao {
  if (sugestao.tipo === "tag") {
    const inserido = `#${sugestao.id}`;
    return { de: gatilho.inicio, ate: cursor, texto: inserido, cursor: gatilho.inicio + inserido.length };
  }
  if (sugestao.tipo === "comando") {
    // `/continuar` só apaga o que foi digitado; o pedido ao Bimo parte depois, de quem aplicou a troca.
    if (sugestao.id === "bimo-continuar") return { de: gatilho.inicio, ate: cursor, texto: "", cursor: gatilho.inicio };
    return aplicarComando(texto, gatilho.inicio, cursor, sugestao.id);
  }
  return planejarInsercaoDeLigacao(texto, gatilho, cursor, sugestao.alvo);
}
