"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { detectarGatilho, type Gatilho } from "../edicao/gatilho-do-editor";
import { aplicarEdicaoNoCampo } from "../edicao/insercao-no-editor";
import type { AcaoDoRascunho } from "../edicao/pedido-de-rascunho";
import { posicaoDoCursor } from "../edicao/posicao-do-cursor";
import { avisoDeAbertura, avisoDeInsercao, planejarInsercao, type Sugestao } from "../edicao/sugestoes";

/** O tamanho aproximado da lista (`max-h-72`, `md:w-80`): decide se cabe abaixo do cursor e até onde ela pode ir à direita. */
const ALTURA_DA_LISTA_PX = 288;
const LARGURA_DA_LISTA_PX = 320;
const FOLGA_PX = 4;

export type PosicaoDaLista = { topo?: number; base?: number; esquerda: number };
type Aberto = {
  gatilho: Gatilho; sugestoes: Sugestao[]; indice: number; posicao: PosicaoDaLista;
  /** A pessoa já escolheu com as setas: só então Tab insere (Tab, sozinho, segue sendo "sair do campo"). */
  navegou: boolean;
};

type Entrada = {
  campo: RefObject<HTMLTextAreaElement | null>;
  /** As opções para o que está sendo digitado (`[[`, `#` ou `/`); sem ela o autocompletar fica desligado. */
  sugerir?: (gatilho: Gatilho) => Sugestao[];
  /** Somente leitura (recuperação de rascunho, renomeação em voo): nada de sugestões. */
  bloqueado: boolean;
  /** Chamado depois de aplicar um comando do Bimo (`/continuar`): o editor faz o pedido. */
  aoComandoDoBimo?: (acao: AcaoDoRascunho) => void;
};

/** O id de uma opção é o dela, não a posição: ao digitar, o topo muda e `aria-activedescendant` precisa mudar junto. */
export function idDaOpcao(idDaLista: string, idDaSugestao: string): string {
  return `${idDaLista}-${encodeURIComponent(idDaSugestao)}`;
}

/**
 * Onde Enter só insere depois de a pessoa escolher com as setas: numa tag (a busca é aproximada: `#ia` viraria
 * `#ideia` sem ela ver) e no `/` sozinho (aplicaria "Título 1" a quem só queria quebrar a linha). Em ligações e
 * em `/letras`, Enter insere a primeira opção, como no Obsidian.
 */
function exigeEscolha(gatilho: Gatilho): boolean {
  return gatilho.tipo === "tag" || (gatilho.tipo === "comando" && gatilho.consulta === "");
}

/** Abaixo do cursor, ou acima quando falta espaço na tela; em px a partir do `<article>` (o `offsetParent` do campo). */
function calcularPosicao(campo: HTMLTextAreaElement, indice: number): PosicaoDaLista {
  const cursor = posicaoDoCursor(campo, indice);
  const pai = campo.offsetParent as HTMLElement | null;
  const x = campo.offsetLeft + cursor.esquerda;
  const esquerda = pai ? Math.max(0, Math.min(x, pai.clientWidth - LARGURA_DA_LISTA_PX)) : x;
  const topoDoCursor = campo.offsetTop + cursor.topo;
  const yNaTela = campo.getBoundingClientRect().top + cursor.topo + cursor.altura;
  // O teclado virtual encolhe só a área visível (`visualViewport`), não `innerHeight`.
  const alturaVisivel = window.visualViewport?.height ?? window.innerHeight;
  const faltaEspacoAbaixo = alturaVisivel - yNaTela < ALTURA_DA_LISTA_PX;
  if (faltaEspacoAbaixo && yNaTela - cursor.altura > ALTURA_DA_LISTA_PX) return { base: (pai?.clientHeight ?? 0) - topoDoCursor + FOLGA_PX, esquerda };
  return { topo: topoDoCursor + cursor.altura + FOLGA_PX, esquerda };
}

/**
 * O autocompletar do editor: detecta o gatilho no texto e no cursor (`[[ligação`, `#tag`, `/comando`), busca as
 * opções, guarda a ativa e aplica a escolhida. O foco fica sempre no campo; a lista é só um `aria-activedescendant`.
 * A lista só ABRE por digitação; mover o cursor apenas a atualiza ou fecha (senão passar com as setas por
 * uma ligação já escrita a abriria e sequestraria ↑/↓/Enter).
 */
export function useSugestoesDoEditor({ campo, sugerir, bloqueado, aoComandoDoBimo }: Entrada) {
  const [aberto, definirAberto] = useState<Aberto | null>(null);
  const [aviso, definirAviso] = useState({ id: 0, texto: "" });
  const atual = useRef<Aberto | null>(null);
  const compondo = useRef(false);
  /** O gatilho em que a pessoa deu Esc: não reabre enquanto ela continuar nele. */
  const dispensado = useRef<{ tipo: Gatilho["tipo"]; inicio: number } | null>(null);
  const idLista = useId();

  const mudar = (proximo: Aberto | null) => { atual.current = proximo; definirAberto(proximo); };
  const falar = (texto: string) => definirAviso((anterior) => ({ id: anterior.id + 1, texto }));
  const fechar = () => { if (atual.current) mudar(null); };

  // Começou uma renomeação com a lista aberta: ela fecha de verdade (não só some), senão voltaria velha ao terminar.
  useEffect(() => {
    if (bloqueado) fechar();
    // `fechar` só mexe numa ref e no estado: não precisa refazer o efeito a cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bloqueado]);

  /** Chamar depois de digitar (`podeAbrir`) ou de mover o cursor (só atualiza uma lista já aberta). */
  function atualizar(podeAbrir: boolean) {
    const elemento = campo.current;
    if (compondo.current) return;
    if (!elemento || !sugerir || bloqueado || elemento.selectionStart !== elemento.selectionEnd) return fechar();
    const anterior = atual.current;
    if (!anterior && !podeAbrir) return;
    const gatilho = detectarGatilho(elemento.value, elemento.selectionStart);
    // `[[Nota#seção` é uma ligação a uma seção: as sugestões são só de notas.
    if (!gatilho || (gatilho.tipo === "ligacao" && gatilho.consulta.includes("#"))) { dispensado.current = null; return fechar(); }
    if (dispensado.current?.tipo === gatilho.tipo && dispensado.current.inicio === gatilho.inicio) return fechar();
    const mesmoGatilho = anterior?.gatilho.tipo === gatilho.tipo && anterior.gatilho.inicio === gatilho.inicio;
    // O `select` que o navegador dispara depois de cada tecla chega com o mesmo estado: não refaz a busca.
    if (anterior && mesmoGatilho && anterior.gatilho.consulta === gatilho.consulta) return;
    const sugestoes = sugerir(gatilho);
    if (sugestoes.length === 0) return fechar();
    // Digitou mais uma letra: a melhor sugestão volta ao topo. A âncora é o início do gatilho, que não muda enquanto a consulta cresce.
    mudar({ gatilho, sugestoes, indice: 0, navegou: false, posicao: anterior && mesmoGatilho ? anterior.posicao : calcularPosicao(elemento, gatilho.inicio) });
    if (!anterior) falar(avisoDeAbertura(gatilho.tipo, sugestoes.length));
  }

  function escolher(indice: number) {
    const elemento = campo.current, aberta = atual.current;
    const sugestao = aberta?.sugestoes[indice];
    if (!elemento || !aberta || !sugestao || bloqueado) return;
    // O texto pode ter mudado por fora (revisão adotada, conflito resolvido) desde que a lista abriu.
    const gatilho = detectarGatilho(elemento.value, elemento.selectionStart);
    if (!gatilho || gatilho.tipo !== aberta.gatilho.tipo || gatilho.inicio !== aberta.gatilho.inicio) return fechar();
    const edicao = planejarInsercao(elemento.value, gatilho, elemento.selectionStart, sugestao);
    mudar(null);
    // Uma tag inserida (`#ideia`) continua casando com o gatilho: sem isto a lista reabriria com ela mesma e o próximo Enter seria engolido.
    dispensado.current = { tipo: gatilho.tipo, inicio: gatilho.inicio };
    aplicarEdicaoNoCampo(elemento, edicao);
    falar(avisoDeInsercao(sugestao));
    // `/continuar`: o texto digitado já saiu (acima); agora o pedido ao Bimo parte do cursor.
    if (sugestao.tipo === "comando" && sugestao.id === "bimo-continuar") aoComandoDoBimo?.("continuar");
  }

  /** `true` quando a tecla foi da lista (e já foi tratada). Durante composição de texto (IME) não toca em nada. */
  function aoTeclar(evento: KeyboardEvent<HTMLTextAreaElement>): boolean {
    const aberta = atual.current;
    if (!aberta || bloqueado || compondo.current || evento.nativeEvent.isComposing || evento.keyCode === 229) return false;
    const total = aberta.sugestoes.length;
    const mover = (passo: number) => mudar({ ...aberta, navegou: true, indice: (aberta.indice + passo + total) % total });
    // Com Shift/Ctrl/Alt/Cmd as setas e o Enter são do campo (selecionar, ir ao início, quebrar linha).
    const semModificador = !evento.ctrlKey && !evento.metaKey && !evento.altKey && !evento.shiftKey;
    if (evento.key === "Escape") { dispensado.current = { tipo: aberta.gatilho.tipo, inicio: aberta.gatilho.inicio }; evento.stopPropagation(); fechar(); }
    else if (!semModificador) return false;
    else if (evento.key === "ArrowDown") mover(1);
    else if (evento.key === "ArrowUp") mover(-1);
    else if (evento.key === "Tab" && aberta.navegou) escolher(aberta.indice);
    else if (evento.key === "Enter" && (aberta.navegou || !exigeEscolha(aberta.gatilho))) escolher(aberta.indice);
    else return false;
    evento.preventDefault();
    return true;
  }

  const visivel = bloqueado ? null : aberto;
  return {
    aberto: visivel, idLista, aviso, atualizar, fechar, escolher, aoTeclar,
    idDaOpcaoAtiva: visivel ? idDaOpcao(idLista, visivel.sugestoes[visivel.indice].id) : undefined,
    aoComporInicio: () => { compondo.current = true; },
    aoComporFim: () => { compondo.current = false; atualizar(true); },
  };
}
