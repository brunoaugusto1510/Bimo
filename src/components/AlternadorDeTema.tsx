"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  CONSULTA_DO_SISTEMA_ESCURO,
  EVENTO_DE_TEMA,
  aplicarTema,
  lerPreferenciaSalva,
  proximaPreferencia,
  salvarPreferencia,
  type PreferenciaDeTema,
} from "@/lib/tema";

const DESCRICAO: Record<PreferenciaDeTema, { nome: string; glifo: string }> = {
  sistema: { nome: "automático", glifo: "◐" },
  claro: { nome: "claro", glifo: "☀" },
  escuro: { nome: "escuro", glifo: "☾" },
};

/** `storage` avisa as outras abas; `EVENTO_DE_TEMA`, esta (o navegador não dispara `storage` na própria aba). */
function assinar(avisar: () => void): () => void {
  window.addEventListener("storage", avisar);
  window.addEventListener(EVENTO_DE_TEMA, avisar);
  return () => {
    window.removeEventListener("storage", avisar);
    window.removeEventListener(EVENTO_DE_TEMA, avisar);
  };
}

/**
 * Botão do header que troca o tema: automático (segue o computador) → claro →
 * escuro. O design system não define um controle de tema; segue o padrão dos
 * botões redondos do header (como o "Sair") e os glifos de texto da iconografia
 * dele. A escolha fica no `localStorage`; o tema em si é aplicado no `<html>`
 * (ver `lib/tema.ts`) — o script do `<head>` já o aplicou antes da primeira
 * pintura, então aqui o efeito só mantém o atributo em dia depois disso.
 */
export default function AlternadorDeTema() {
  // No servidor não há preferência: `sistema` é o ponto de partida, e o cliente corrige logo após hidratar.
  const preferencia = useSyncExternalStore(assinar, lerPreferenciaSalva, () => "sistema" as const);

  useEffect(() => {
    aplicarTema(preferencia);
    if (preferencia !== "sistema") return;

    // No automático o tema acompanha o computador, inclusive se ele mudar com a página aberta.
    const sistema = window.matchMedia?.(CONSULTA_DO_SISTEMA_ESCURO);
    const aoMudar = () => aplicarTema("sistema");
    sistema?.addEventListener("change", aoMudar);
    return () => sistema?.removeEventListener("change", aoMudar);
  }, [preferencia]);

  const atual = DESCRICAO[preferencia];
  const proxima = DESCRICAO[proximaPreferencia(preferencia)];
  const rotulo = `Tema ${atual.nome}. Mudar para ${proxima.nome}.`;

  return (
    <button
      type="button"
      onClick={() => salvarPreferencia(proximaPreferencia(preferencia))}
      aria-label={rotulo}
      title={rotulo}
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-borda bg-painel text-base text-suave transition-[color,background-color,transform] hover:bg-painel-alt hover:text-texto motion-safe:active:scale-[0.96]"
    >
      <span aria-hidden>{atual.glifo}</span>
    </button>
  );
}
