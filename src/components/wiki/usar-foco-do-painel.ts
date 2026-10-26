"use client";
import { useEffect, useRef } from "react";
/** Telas sobrepostas recebem o foco e o devolvem ao controle de origem ao fechar. */
export function useFocoDoPainel(chave: string | null) {
  const painel = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!chave) return;
    const anterior = document.activeElement;
    const elemento = painel.current;
    // O mesmo elemento serve ao cérebro e ao diário: trocar de tela começa do alto, não da rolagem da tela anterior.
    if (painel.current) painel.current.scrollTop = 0;
    painel.current?.focus({ preventScroll: true });
    return () => {
      // Só devolve o foco se ele ainda estava no painel (ou se perdeu com ele). Trocar de tela por um controle de fora
      // (o chip "Diário" com o cérebro aberto) deixa o foco nesse controle, que vira o destino da próxima volta.
      const ativo = document.activeElement;
      const ficouNoPainel = !ativo || ativo === document.body || Boolean(elemento?.contains(ativo));
      if (ficouNoPainel && anterior instanceof HTMLElement && anterior.isConnected) anterior.focus({ preventScroll: true });
    };
  }, [chave]);
  return painel;
}
