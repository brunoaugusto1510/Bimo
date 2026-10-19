"use client";
import { useEffect, useId, useRef, useState } from "react";
import { validarTitulo } from "@/lib/caminho-da-nota";

type Props = { titulo: string; focar?: boolean; aoConsumirFoco?: () => void; aoConfirmar(titulo: string): Promise<unknown>; aoTexto(): void; aoMudarPendencia?(pendente: boolean): void };

export default function CampoDeTitulo({ titulo, focar = false, aoConsumirFoco, aoConfirmar, aoTexto, aoMudarPendencia }: Props) {
  const [texto, definirTexto] = useState(titulo);
  const [erro, definirErro] = useState("");
  const [salvando, definirSalvando] = useState(false);
  const campo = useRef<HTMLInputElement>(null);
  const emVoo = useRef(false);
  const cancelado = useRef(false);
  const focado = useRef(false);
  const tituloDoTexto = useRef(titulo);
  const [anuncio, anunciar] = useState({ id: 0, texto: "" });
  const [tentativa, definirTentativa] = useState(0);
  const id = useId();
  useEffect(() => {
    if (focado.current || emVoo.current) return;
    // Sincroniza uma alteração externa somente quando não há digitação pendente.
    definirTexto(titulo);
    tituloDoTexto.current = titulo;
  }, [titulo]);
  useEffect(() => {
    if (!anuncio.texto) return;
    const timer = setTimeout(() => anunciar((atual) => ({ ...atual, texto: "" })), 2000);
    return () => clearTimeout(timer);
  }, [anuncio]);
  useEffect(() => {
    if (!focar) return;
    campo.current?.focus({ preventScroll: true }); campo.current?.select(); aoConsumirFoco?.();
  }, [focar, aoConsumirFoco]);
  async function confirmar(irAoTexto: boolean) {
    if (cancelado.current || emVoo.current) return;
    definirTentativa((n) => n + 1);
    const validacao = validarTitulo(texto);
    if (!validacao.ok) { definirErro(validacao.motivo); return; }
    if (validacao.titulo === titulo) { definirErro(""); if (irAoTexto) aoTexto(); return; }
    emVoo.current = true; definirSalvando(true);
    try { await aoConfirmar(validacao.titulo); definirTexto(validacao.titulo); tituloDoTexto.current = validacao.titulo; definirErro(""); aoMudarPendencia?.(false); anunciar((a) => ({ id: a.id + 1, texto: `Título alterado para «${validacao.titulo}»` })); if (irAoTexto) aoTexto(); }
    catch (erro) { definirErro(erro instanceof Error ? erro.message : "Não foi possível renomear."); }
    finally { emVoo.current = false; definirSalvando(false); }
  }
  return <div className="mb-4">
    <input ref={campo} aria-label="Título da nota" aria-invalid={!!erro} aria-describedby={`${id}-dica${erro ? ` ${id}` : ""}`} aria-busy={salvando} readOnly={salvando} aria-readonly={salvando}
      value={texto} onChange={(evento) => { cancelado.current = false; definirTexto(evento.target.value); aoMudarPendencia?.(evento.target.value !== titulo); }}
      onFocus={() => { focado.current = true; cancelado.current = false; }} onBlur={() => {
        focado.current = false;
        if (!emVoo.current && texto === tituloDoTexto.current && titulo !== tituloDoTexto.current) {
          definirTexto(titulo); tituloDoTexto.current = titulo; aoMudarPendencia?.(false); return;
        }
        void confirmar(false);
      }}
      onKeyDown={(evento) => {
        if (evento.nativeEvent.isComposing) return;
        if (evento.key === "Enter") { evento.preventDefault(); void confirmar(true); }
        if (evento.key === "Escape" && !emVoo.current) { evento.preventDefault(); evento.stopPropagation(); cancelado.current = true; definirTexto(titulo); definirErro(""); aoMudarPendencia?.(false); anunciar((a) => ({ id: a.id + 1, texto: "Título restaurado" })); aoTexto(); }
      }} className="min-h-10 w-full rounded-bloco border border-borda bg-painel px-2 text-titulo-nota font-semibold text-destaque-texto focus-visible:border-destaque" />
    <span id={`${id}-dica`} className="sr-only">Enter confirma e vai ao texto. Esc desfaz.</span>
    <p id={id} role="alert" className="mt-2 text-meta text-erro"><span key={tentativa}>{erro}</span></p>
    <p role="status" className="sr-only"><span key={anuncio.id}>{anuncio.texto}</span></p>
  </div>;
}
