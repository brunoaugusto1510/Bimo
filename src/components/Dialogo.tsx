"use client";
import { useEffect, useId, useRef, type ReactNode } from "react";

export default function Dialogo({ titulo, aoFechar, ocupado = false, children }: {
  titulo: string; aoFechar(): void; ocupado?: boolean; children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null), id = useId();
  useEffect(() => {
    const anterior = document.activeElement, dialogo = ref.current;
    if (dialogo && !dialogo.open) {
      if (typeof dialogo.showModal === "function") dialogo.showModal();
      else dialogo.setAttribute("open", "");
    }
    (dialogo?.querySelector<HTMLElement>("[data-foco-inicial]") ?? dialogo?.querySelector<HTMLElement>("button"))?.focus();
    return () => { if (anterior instanceof HTMLElement && anterior.isConnected) anterior.focus(); };
  }, []);
  return <dialog ref={ref} aria-labelledby={id} aria-modal="true" onCancel={(e) => { e.preventDefault(); if (!ocupado) aoFechar(); }}
    onKeyDown={(e) => {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); if (!ocupado) aoFechar(); }
      if (e.key !== "Tab") return;
      const itens = [...(ref.current?.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), [tabindex='0']") ?? [])];
      const primeiro = itens[0], ultimo = itens.at(-1);
      if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo?.focus(); }
      else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro?.focus(); }
    }} className="fixed inset-0 z-50 m-auto max-h-[85dvh] w-[calc(100%_-_2rem)] max-w-xl overflow-y-auto rounded-bloco border border-borda bg-painel p-5 text-texto shadow-foco backdrop:bg-black/40">
    <div className="mb-4 flex items-center justify-between gap-4"><h2 id={id} className="text-lg font-semibold">{titulo}</h2>
      <button type="button" aria-label="Fechar" disabled={ocupado} onClick={aoFechar} className="min-h-10 min-w-10 rounded-full hover:bg-painel-alt disabled:opacity-50">×</button>
    </div>{children}
  </dialog>;
}
