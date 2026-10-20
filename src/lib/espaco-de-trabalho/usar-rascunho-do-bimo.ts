"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { ErroDoCliente } from "../cliente-de-notas";
import { pedirRascunho } from "../cliente-de-rascunho";
import { aplicarEdicaoNoCampo } from "../edicao/insercao-no-editor";
import { montarPedido, planejarAceite, type AcaoDoRascunho, type Ancora } from "../edicao/pedido-de-rascunho";

export type EstadoDoRascunho =
  | { tipo: "ocioso" }
  | { tipo: "gerando"; acao: AcaoDoRascunho }
  | { tipo: "proposta"; acao: AcaoDoRascunho; texto: string }
  /** `acao` é `null` quando nem deu para pedir (sem seleção, sem texto antes do cursor): não há o que repetir. */
  | { tipo: "erro"; acao: AcaoDoRascunho | null; mensagem: string };

type Entrada = {
  campo: RefObject<HTMLTextAreaElement | null>;
  titulo: string;
  /** Somente leitura (recuperação de rascunho, renomeação em voo): nada de pedir, e o que estiver em voo é cancelado. */
  desabilitado: boolean;
};

const MENSAGEM_GENERICA = "Não consegui gerar o rascunho agora. Tente de novo.";

/**
 * O fluxo "Bimo sugere": pede um trecho ao servidor e o guarda como PROPOSTA, sem tocar no texto. Só `aceitar`
 * escreve, pelo mesmo caminho da digitação (o autosave guarda como qualquer outra mudança), e só se o texto ainda
 * é o do pedido. Lê o texto e a seleção direto do campo: o que está na tela, inclusive o que ainda não foi salvo.
 */
export function useRascunhoDoBimo({ campo, titulo, desabilitado }: Entrada) {
  const [estado, definirEstado] = useState<EstadoDoRascunho>({ tipo: "ocioso" });
  const [aviso, definirAviso] = useState({ id: 0, texto: "" });
  const controle = useRef<AbortController | null>(null);
  const ancora = useRef<Ancora | null>(null);
  /** Cada pedido tem um número: a resposta de um pedido que já foi cancelado ou substituído não vale. */
  const pedido = useRef(0);

  const falar = (texto: string) => definirAviso((anterior) => ({ id: anterior.id + 1, texto }));
  const interromper = () => { controle.current?.abort(); controle.current = null; pedido.current++; };
  const voltarAoTexto = () => campo.current?.focus({ preventScroll: true });

  useEffect(() => () => controle.current?.abort(), []);
  useEffect(() => {
    if (desabilitado && controle.current) { interromper(); definirEstado({ tipo: "ocioso" }); falar("Pedido cancelado: a nota está sendo atualizada."); }
  }, [desabilitado]);

  async function pedir(acao: AcaoDoRascunho): Promise<void> {
    const elemento = campo.current;
    if (!elemento || desabilitado) return;
    const montado = montarPedido({ acao, texto: elemento.value, inicio: elemento.selectionStart, fim: elemento.selectionEnd, titulo });
    if (!montado.ok) { interromper(); definirEstado({ tipo: "erro", acao: null, mensagem: montado.motivo }); return; }
    interromper();
    const numero = pedido.current;
    const aborto = new AbortController();
    controle.current = aborto;
    ancora.current = montado.ancora;
    definirEstado({ tipo: "gerando", acao });
    // O cartão "escrevendo" nasce já com o texto: um leitor de tela nem sempre fala uma região viva que nasce preenchida.
    falar("O Bimo está escrevendo.");
    try {
      const texto = await pedirRascunho(montado.pedido, aborto.signal);
      if (numero !== pedido.current) return;
      controle.current = null;
      definirEstado({ tipo: "proposta", acao, texto });
      falar("Proposta do Bimo pronta. Aceitar, descartar ou tentar de novo.");
    } catch (erro) {
      if (numero !== pedido.current) return;
      controle.current = null;
      definirEstado({ tipo: "erro", acao, mensagem: erro instanceof ErroDoCliente ? erro.message : MENSAGEM_GENERICA });
    }
  }

  function cancelar() {
    interromper();
    definirEstado({ tipo: "ocioso" });
    falar("Pedido cancelado.");
    voltarAoTexto();
  }

  function descartar() {
    definirEstado({ tipo: "ocioso" });
    falar("Proposta descartada.");
    voltarAoTexto();
  }

  /** Fecha a mensagem de erro (ou qualquer cartão) sem dizer nada. */
  function fechar() {
    interromper();
    definirEstado({ tipo: "ocioso" });
    voltarAoTexto();
  }

  function aceitar() {
    const elemento = campo.current;
    if (estado.tipo !== "proposta" || !ancora.current || !elemento) return;
    // `setRangeText` ignora o `readOnly`: com uma renomeação em voo o texto não pode mudar por baixo. É passageiro,
    // então a proposta (que já custou um pedido) fica onde está para a pessoa aceitar de novo.
    if (elemento.readOnly) { falar("O texto está ocupado agora. Tente aceitar de novo em instantes."); return; }
    const plano = planejarAceite(ancora.current, elemento.value, estado.texto);
    if (!plano.ok) { definirEstado({ tipo: "erro", acao: estado.acao, mensagem: plano.motivo }); return; }
    aplicarEdicaoNoCampo(elemento, plano.edicao);
    definirEstado({ tipo: "ocioso" });
    falar("Proposta aceita.");
  }

  function tentarDeNovo(): Promise<void> {
    return "acao" in estado && estado.acao ? pedir(estado.acao) : Promise.resolve();
  }

  return { estado, aviso, pedir, cancelar, aceitar, descartar, tentarDeNovo, fechar };
}
