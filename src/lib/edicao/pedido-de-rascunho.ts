import type { Edicao } from "./insercao-no-editor";
import { neutralizarImagens } from "./neutralizar-imagens";

export type AcaoDoRascunho = "continuar" | "resumir" | "melhorar";

/** Os mesmos limites que o servidor aceita (`validacao-do-rascunho.ts`): o cliente corta o contexto para caber. */
export const LIMITES_DO_RASCUNHO = { antes: 4000, depois: 2000, trecho: 8000, titulo: 200 } as const;

export type PedidoDeRascunho = { acao: AcaoDoRascunho; titulo: string; antes: string; depois: string; trecho: string };

/** O que o texto era quando o pedido saiu: o aceite só insere se isto ainda vale. */
export type Ancora = { acao: AcaoDoRascunho; inicio: number; fim: number; antes: string; trecho: string; depois: string; tamanho: number };

type Entrada = { acao: AcaoDoRascunho; texto: string; inicio: number; fim: number; titulo: string };

const PEDIR_DE_NOVO = "O texto mudou depois do pedido. Peça de novo.";

const ehSubstitutoBaixo = (unidade: number) => unidade >= 0xdc00 && unidade <= 0xdfff;
const ehSubstitutoAlto = (unidade: number) => unidade >= 0xd800 && unidade <= 0xdbff;

/** `texto.slice(inicio, fim)` sem partir um emoji (par substituto) nas pontas: o servidor receberia meio caractere. */
function recortar(texto: string, inicio: number, fim: number): string {
  const de = inicio > 0 && inicio < texto.length && ehSubstitutoBaixo(texto.charCodeAt(inicio)) ? inicio + 1 : inicio;
  const ate = fim < texto.length && fim > de && ehSubstitutoAlto(texto.charCodeAt(fim - 1)) ? fim - 1 : fim;
  return texto.slice(de, ate);
}

/** O pedido ao servidor a partir do texto do editor (inclusive o não salvo) e da seleção, ou o motivo de não dar para pedir. */
export function montarPedido({ acao, texto, inicio, fim, titulo }: Entrada): { ok: true; pedido: PedidoDeRascunho; ancora: Ancora } | { ok: false; motivo: string } {
  const comeco = acao === "continuar" ? fim : inicio;
  const trecho = acao === "continuar" ? "" : texto.slice(inicio, fim);
  if (acao === "continuar" && texto.slice(0, fim).trim() === "") return { ok: false, motivo: "Escreva algo antes do cursor para o Bimo continuar." };
  if (acao !== "continuar" && trecho.trim() === "") return { ok: false, motivo: `Selecione um trecho do texto para o Bimo ${acao}.` };
  if (trecho.length > LIMITES_DO_RASCUNHO.trecho) return { ok: false, motivo: "Selecione um trecho menor (até 8.000 caracteres)." };
  const antes = recortar(texto, Math.max(0, comeco - LIMITES_DO_RASCUNHO.antes), comeco);
  const depois = recortar(texto, fim, fim + LIMITES_DO_RASCUNHO.depois);
  return {
    ok: true,
    pedido: { acao, titulo: recortar(titulo.trim(), 0, LIMITES_DO_RASCUNHO.titulo), antes, depois, trecho },
    ancora: { acao, inicio: comeco, fim, antes, trecho, depois, tamanho: texto.length },
  };
}

/**
 * A troca que aceitar a proposta faz, ou por que não dá. Confere a âncora no texto de agora: se a pessoa
 * digitou depois do pedido (antes, na seleção ou logo depois do cursor), os índices guardados não valem e nada
 * é inserido (nunca no lugar errado). Continuar entra no cursor; melhorar troca a seleção (guardando o espaço
 * ao redor); resumir vai depois da seleção, em outro parágrafo, sem apagar nada. A proposta nunca leva imagem.
 */
export function planejarAceite(ancora: Ancora, textoAtual: string, proposta: string): { ok: true; edicao: Edicao } | { ok: false; motivo: string } {
  // O campo só tem `\n`: um `\r\n` na proposta desalinharia o cursor.
  const limpa = neutralizarImagens(proposta.replace(/\r\n?/g, "\n"));
  const nova = ancora.acao === "continuar" ? limpa.trimEnd() : limpa.trim();
  if (nova.trim() === "") return { ok: false, motivo: "O Bimo não devolveu texto. Tente de novo." };

  // Qualquer mudança no tamanho do texto (digitar no fim, apagar longe) já invalida; o resto pega a troca de mesmo tamanho.
  // O contexto "antes" sempre termina onde a âncora começa (no cursor, ou no início da seleção).
  const antesIgual = textoAtual.slice(ancora.inicio - ancora.antes.length, ancora.inicio) === ancora.antes;
  const depoisIgual = textoAtual.slice(ancora.fim, ancora.fim + ancora.depois.length) === ancora.depois;
  const trechoIgual = ancora.acao === "continuar" || textoAtual.slice(ancora.inicio, ancora.fim) === ancora.trecho;
  if (textoAtual.length !== ancora.tamanho || !antesIgual || !depoisIgual || !trechoIgual) return { ok: false, motivo: PEDIR_DE_NOVO };

  if (ancora.acao === "continuar") {
    const antesDoCursor = textoAtual.slice(0, ancora.inicio);
    const precisaDeEspaco = antesDoCursor !== "" && !/\s$/.test(antesDoCursor) && /^[\p{L}\p{N}]/u.test(nova);
    const texto = (precisaDeEspaco ? " " : "") + nova;
    return { ok: true, edicao: { de: ancora.inicio, ate: ancora.inicio, texto, cursor: ancora.inicio + texto.length } };
  }

  if (ancora.acao === "melhorar") {
    const texto = ancora.trecho.match(/^\s*/)![0] + nova + ancora.trecho.match(/\s*$/)![0];
    return { ok: true, edicao: { de: ancora.inicio, ate: ancora.fim, texto, cursor: ancora.inicio + texto.length } };
  }

  // O resumo é um parágrafo à parte: sem linha em branco depois dele, a linha seguinte se fundiria com ele.
  const depoisDaSelecao = textoAtual.slice(ancora.fim);
  const fechamento = depoisDaSelecao === "" || depoisDaSelecao.startsWith("\n\n") ? "" : depoisDaSelecao.startsWith("\n") ? "\n" : "\n\n";
  const texto = `\n\n${nova}${fechamento}`;
  return { ok: true, edicao: { de: ancora.fim, ate: ancora.fim, texto, cursor: ancora.fim + texto.length } };
}
