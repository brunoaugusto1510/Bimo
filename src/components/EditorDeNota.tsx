"use client";
import { useEffect, useId, useLayoutEffect, useRef } from "react";
import { combinaAtalho } from "@/lib/atalhos";

type Props = { texto: string; titulo?: string; focarAoEntrar?: boolean; descricaoRecuperacao?: string; aguardandoRecuperacao?: boolean; ocupado?: boolean; aoMudar(texto: string): void; forcar(opcoes: { checkpoint: boolean }): unknown };
export default function EditorDeNota({ texto, titulo = "", focarAoEntrar = false, descricaoRecuperacao, aoMudar, forcar, aguardandoRecuperacao = false, ocupado = false }: Props) {
  const campo = useRef<HTMLTextAreaElement>(null);
  const idOcupado = useId();
  useEffect(() => { if (focarAoEntrar && !aguardandoRecuperacao) campo.current?.focus({ preventScroll: true }); }, [focarAoEntrar, aguardandoRecuperacao]);
  useLayoutEffect(() => {
    const elemento = campo.current;
    if (!elemento) return;
    function ajustar() {
      if (!elemento) return;
      elemento.style.height = "auto";
      elemento.style.height = `${elemento.scrollHeight + elemento.offsetHeight - elemento.clientHeight}px`;
    }
    ajustar();
    let largura = elemento.clientWidth;
    const observador = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => {
      if (elemento.clientWidth !== largura) { largura = elemento.clientWidth; ajustar(); }
    });
    observador?.observe(elemento);
    return () => observador?.disconnect();
  }, [texto]);
  return <>
    {/* Enquanto a renomeação reescreve as ligações o texto não aceita digitação: o aviso explica por quê. */}
    <p id={idOcupado} role="status" className={ocupado ? "mb-2 text-meta text-texto" : "sr-only"}>{ocupado ? "Renomeando a nota…" : ""}</p>
    <textarea ref={campo} value={texto} maxLength={1_000_000} readOnly={aguardandoRecuperacao || ocupado} aria-busy={ocupado}
      aria-describedby={ocupado ? idOcupado : aguardandoRecuperacao ? descricaoRecuperacao : undefined} onChange={(evento) => aoMudar(evento.target.value)}
      aria-label={`Texto da nota ${titulo}, Markdown`} aria-keyshortcuts="Control+S Meta+S" spellCheck lang="pt-BR"
      onKeyDown={(evento) => {
        if (combinaAtalho(evento.nativeEvent, "mod+s")) { evento.preventDefault(); evento.stopPropagation(); if (!aguardandoRecuperacao) void forcar({ checkpoint: true }); }
      }} className="block min-h-64 w-full resize-none overflow-hidden rounded-bloco border border-borda bg-painel p-2 text-base leading-relaxed text-texto outline-offset-2 [field-sizing:content] read-only:bg-painel-alt focus-visible:border-destaque md:text-corpo" />
  </>;
}
