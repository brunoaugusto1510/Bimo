"use client";
import { useEffect, useId, useRef, useState } from "react";
import { validarTitulo } from "@/lib/caminho-da-nota";

type Props = {
  titulo: string; focar?: boolean; confirmarAoSair?: boolean; aoConsumirFoco?: () => void;
  aoConfirmar(titulo: string): Promise<{ notasReescritas?: number } | void>; aoTexto(): void;
  aoMudarPendencia?(pendente: boolean): void;
  /** Primeira saída do campo (já processada): a nota deixa de ser "recém-criada" para o blur. */
  aoSair?(): void;
};

/** Perder a janela (Alt-Tab, outra aba) dispara blur no campo, mas a pessoa não saiu dele. */
const janelaPerdeuOFoco = () => document.visibilityState === "hidden" || !document.hasFocus();

export default function CampoDeTitulo({ titulo, focar = false, confirmarAoSair = false, aoConsumirFoco, aoConfirmar, aoTexto, aoMudarPendencia, aoSair }: Props) {
  const [texto, definirTexto] = useState(titulo);
  const [erro, definirErro] = useState("");
  const [salvando, definirSalvando] = useState(false);
  const campo = useRef<HTMLInputElement>(null);
  const emVoo = useRef(false);
  const cancelado = useRef(false);
  const focado = useRef(false);
  const montado = useRef(true);
  const tituloDoTexto = useRef(titulo);
  const [anuncio, anunciar] = useState({ id: 0, texto: "" });
  const [tentativa, definirTentativa] = useState(0);
  const id = useId();
  useEffect(() => {
    montado.current = true;
    return () => { montado.current = false; };
  }, []);
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
  function falar(texto: string) { anunciar((a) => ({ id: a.id + 1, texto })); }
  function restaurar() {
    definirTexto(titulo); tituloDoTexto.current = titulo; definirErro(""); aoMudarPendencia?.(false);
  }
  async function confirmar(irAoTexto: boolean) {
    if (cancelado.current || emVoo.current) return;
    // O que vale é o modo de quando a confirmação começou: sair do campo pode mudá-lo depois.
    const restaurarNoErro = !confirmarAoSair;
    definirTentativa((n) => n + 1);
    const validacao = validarTitulo(texto);
    if (!validacao.ok) { definirErro(validacao.motivo); return; }
    if (validacao.titulo === titulo) { restaurar(); if (irAoTexto) aoTexto(); return; }
    emVoo.current = true; definirSalvando(true);
    try {
      const resultado = await aoConfirmar(validacao.titulo);
      if (!montado.current) return;
      const quantidade = resultado?.notasReescritas ?? 0;
      const sufixo = quantidade === 1 ? "; 1 nota teve a ligação atualizada" : quantidade > 0 ? `; ${quantidade} notas tiveram ligações atualizadas` : "";
      definirTexto(validacao.titulo); tituloDoTexto.current = validacao.titulo; definirErro(""); aoMudarPendencia?.(false);
      falar(`Título alterado para «${validacao.titulo}»${sufixo}`);
      if (irAoTexto) aoTexto();
    }
    catch (erro) {
      if (!montado.current) return;
      definirErro(erro instanceof Error ? erro.message : "Não foi possível renomear.");
      // Saiu do campo durante o pedido e a nota não é recém-criada: não deixa o texto recusado à mostra.
      if (restaurarNoErro && !focado.current) { definirTexto(titulo); tituloDoTexto.current = titulo; aoMudarPendencia?.(false); }
    }
    finally { emVoo.current = false; definirSalvando(false); }
  }
  function aoSairDoCampo() {
    focado.current = false;
    if (janelaPerdeuOFoco()) return;
    aoSair?.();
    if (emVoo.current) return;
    if (!confirmarAoSair) {
      if (texto.trim() !== titulo) falar(`Título não confirmado; mantido «${titulo}»`);
      restaurar(); return;
    }
    if (texto === tituloDoTexto.current && titulo !== tituloDoTexto.current) {
      definirTexto(titulo); tituloDoTexto.current = titulo; aoMudarPendencia?.(false); return;
    }
    void confirmar(false);
  }
  return <div className="mb-4">
    <input ref={campo} aria-label="Título da nota" aria-invalid={!!erro} aria-describedby={`${id}-dica${erro ? ` ${id}` : ""}`} aria-busy={salvando} readOnly={salvando}
      enterKeyHint="next" autoComplete="off"
      value={texto} onChange={(evento) => { cancelado.current = false; definirTexto(evento.target.value); aoMudarPendencia?.(evento.target.value !== titulo); }}
      onFocus={() => { focado.current = true; cancelado.current = false; }} onBlur={aoSairDoCampo}
      onKeyDown={(evento) => {
        if (evento.nativeEvent.isComposing || evento.keyCode === 229) return;
        if (evento.key === "Enter") { evento.preventDefault(); void confirmar(true); }
        if (evento.key === "Escape" && !emVoo.current) {
          evento.preventDefault(); evento.stopPropagation(); cancelado.current = true;
          if (texto !== titulo) falar("Título restaurado");
          restaurar(); aoTexto();
        }
      }} className="min-h-10 w-full rounded-bloco border border-borda bg-painel px-2 text-titulo-nota font-semibold text-destaque-texto focus-visible:border-destaque" />
    <span id={`${id}-dica`} className="sr-only">{confirmarAoSair
      ? "Enter confirma e vai ao texto. Esc desfaz. Ao sair, o título é confirmado."
      : "Enter confirma e vai ao texto. Esc desfaz. Ao sair sem confirmar, o título volta ao anterior."}</span>
    <p id={id} role="alert" className="mt-2 text-meta text-erro"><span key={tentativa}>{erro}</span></p>
    <p role="status" className="sr-only"><span key={anuncio.id}>{anuncio.texto}</span></p>
  </div>;
}
