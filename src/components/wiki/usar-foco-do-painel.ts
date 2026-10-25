"use client";
import { useEffect, useRef } from "react";
/** Telas sobrepostas recebem o foco e o devolvem ao controle de origem ao fechar. */
export function useFocoDoPainel(chave: string | null) {
  const painel = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!chave) return;
    const anterior = document.activeElement;
    painel.current?.focus({ preventScroll: true });
    return () => { if (anterior instanceof HTMLElement && anterior.isConnected) anterior.focus({ preventScroll: true }); };
  }, [chave]);
  return painel;
}
