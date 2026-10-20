"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { detectarGatilho, type Gatilho } from "../edicao/gatilho-do-editor";
import { aplicarEdicaoNoCampo, planejarInsercaoDeLigacao } from "../edicao/insercao-no-editor";
import { posicaoDoCursor } from "../edicao/posicao-do-cursor";
import type { SugestaoDeLigacao } from "../edicao/sugestoes-de-ligacao";

/** O tamanho aproximado da lista (`max-h-72`, `md:w-80`): decide se cabe abaixo do cursor e até onde ela pode ir à direita. */
const ALTURA_DA_LISTA_PX = 288;
const LARGURA_DA_LISTA_PX = 320;
const FOLGA_PX = 4;

type GatilhoDeLigacao = Extract<Gatilho, { tipo: "ligacao" }>;
export type PosicaoDaLista = { topo?: number; base?: number; esquerda: number };
type Aberto = {
  gatilho: GatilhoDeLigacao; sugestoes: SugestaoDeLigacao[]; indice: number; posicao: PosicaoDaLista;
  /** A pessoa já escolheu com as setas: só então Tab insere (Tab, sozinho, segue sendo "sair do campo"). */
  navegou: boolean;
};

type Entrada = {
  campo: RefObject<HTMLTextAreaElement | null>;
  /** Sem ela o autocompletar fica desligado. */
  sugerir?: (consulta: string) => SugestaoDeLigacao[];
  /** Somente leitura (recuperação de rascunho, renomeação em voo): nada de sugestões. */
  bloqueado: boolean;
};

/** O id de uma opção é o da nota, não a posição: ao digitar, o topo muda e `aria-activedescendant` precisa mudar junto. */
export function idDaOpcao(idDaLista: string, idDaNota: string): string {
  return `${idDaLista}-${encodeURIComponent(idDaNota)}`;
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
 * O autocompletar de `[[`: detecta o gatilho no texto e no cursor, busca as notas, guarda a opção ativa e
 * insere o alvo escolhido. O foco fica sempre no campo; a lista é só um `aria-activedescendant`.
 * A lista só ABRE por digitação; mover o cursor apenas a atualiza ou fecha (senão passar com as setas por
 * uma ligação já escrita a abriria e sequestraria ↑/↓/Enter).
 */
export function useSugestoesDoEditor({ campo, sugerir, bloqueado }: Entrada) {
  const [aberto, definirAberto] = useState<Aberto | null>(null);
  const [aviso, definirAviso] = useState({ id: 0, texto: "" });
  const atual = useRef<Aberto | null>(null);
  const compondo = useRef(false);
  /** O `[[` em que a pessoa deu Esc: não reabre enquanto ela continuar nele. */
  const dispensado = useRef<number | null>(null);
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
    if (gatilho?.tipo !== "ligacao" || gatilho.consulta.includes("#")) { dispensado.current = null; return fechar(); }
    if (dispensado.current === gatilho.inicio) return fechar();
    const mesmoGatilho = anterior?.gatilho.inicio === gatilho.inicio;
    // O `select` que o navegador dispara depois de cada tecla chega com o mesmo estado: não refaz a busca.
    if (anterior && mesmoGatilho && anterior.gatilho.consulta === gatilho.consulta) return;
    const sugestoes = sugerir(gatilho.consulta);
    if (sugestoes.length === 0) return fechar();
    // Digitou mais uma letra: a melhor sugestão volta ao topo. A âncora é o início do `[[`, que não muda enquanto a consulta cresce.
    mudar({ gatilho, sugestoes, indice: 0, navegou: false, posicao: anterior && mesmoGatilho ? anterior.posicao : calcularPosicao(elemento, gatilho.inicio) });
    if (!anterior) falar(`${sugestoes.length} ${sugestoes.length === 1 ? "nota sugerida" : "notas sugeridas"}. Setas escolhem, Enter insere, Esc fecha.`);
  }

  function escolher(indice: number) {
    const elemento = campo.current, aberta = atual.current;
    const sugestao = aberta?.sugestoes[indice];
    if (!elemento || !aberta || !sugestao || bloqueado) return;
    // O texto pode ter mudado por fora (revisão adotada, conflito resolvido) desde que a lista abriu.
    const gatilho = detectarGatilho(elemento.value, elemento.selectionStart);
    if (gatilho?.tipo !== "ligacao" || gatilho.inicio !== aberta.gatilho.inicio) return fechar();
    const edicao = planejarInsercaoDeLigacao(elemento.value, gatilho, elemento.selectionStart, sugestao.alvo);
    mudar(null);
    aplicarEdicaoNoCampo(elemento, edicao);
    falar(`Ligação inserida: «${sugestao.titulo}»`);
  }

  /** `true` quando a tecla foi da lista (e já foi tratada). Durante composição de texto (IME) não toca em nada. */
  function aoTeclar(evento: KeyboardEvent<HTMLTextAreaElement>): boolean {
    const aberta = atual.current;
    if (!aberta || bloqueado || compondo.current || evento.nativeEvent.isComposing || evento.keyCode === 229) return false;
    const total = aberta.sugestoes.length;
    const mover = (passo: number) => mudar({ ...aberta, navegou: true, indice: (aberta.indice + passo + total) % total });
    // Com Shift/Ctrl/Alt/Cmd as setas e o Enter são do campo (selecionar, ir ao início, quebrar linha).
    const semModificador = !evento.ctrlKey && !evento.metaKey && !evento.altKey && !evento.shiftKey;
    if (evento.key === "Escape") { dispensado.current = aberta.gatilho.inicio; evento.stopPropagation(); fechar(); }
    else if (!semModificador) return false;
    else if (evento.key === "ArrowDown") mover(1);
    else if (evento.key === "ArrowUp") mover(-1);
    else if (evento.key === "Enter" || (evento.key === "Tab" && aberta.navegou)) escolher(aberta.indice);
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
