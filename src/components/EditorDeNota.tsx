"use client";
import { useEffect, useId, useLayoutEffect, useRef } from "react";
import { combinaAtalho } from "@/lib/atalhos";
import type { Gatilho } from "@/lib/edicao/gatilho-do-editor";
import type { AcaoDoRascunho } from "@/lib/edicao/pedido-de-rascunho";
import { paraItemDaLista, rotuloDaLista, type Sugestao } from "@/lib/edicao/sugestoes";
import { useRascunhoDoBimo } from "@/lib/espaco-de-trabalho/usar-rascunho-do-bimo";
import { useSugestoesDoEditor } from "@/lib/espaco-de-trabalho/usar-sugestoes-do-editor";
import BarraDoBimo from "./BarraDoBimo";
import CartaoDoRascunho from "./CartaoDoRascunho";
import SugestoesDoEditor from "./SugestoesDoEditor";

type Props = {
  texto: string; titulo?: string; focarAoEntrar?: boolean; descricaoRecuperacao?: string; aguardandoRecuperacao?: boolean; ocupado?: boolean;
  /** As opções para o que foi digitado (`[[nota`, `#tag`, `/comando`); sem ela, o autocompletar fica desligado. */
  sugerir?: (gatilho: Gatilho) => Sugestao[];
  /** Mostra o "Bimo sugere" (Continuar, Resumir e Melhorar a seleção) e aceita o `/continuar`. */
  rascunhoDoBimo?: boolean;
  aoMudar(texto: string): void; forcar(opcoes: { checkpoint: boolean }): unknown;
};
export default function EditorDeNota({ texto, titulo = "", focarAoEntrar = false, descricaoRecuperacao, aoMudar, forcar, sugerir, rascunhoDoBimo = false, aguardandoRecuperacao = false, ocupado = false }: Props) {
  const campo = useRef<HTMLTextAreaElement>(null);
  const idOcupado = useId();
  const bloqueado = aguardandoRecuperacao || ocupado;
  const rascunho = useRascunhoDoBimo({ campo, titulo, desabilitado: bloqueado || !rascunhoDoBimo });
  const sugestoes = useSugestoesDoEditor({
    campo, sugerir, bloqueado,
    aoComandoDoBimo: rascunhoDoBimo ? (acao: AcaoDoRascunho) => { void rascunho.pedir(acao); } : undefined,
  });
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
    {/* Enquanto renomear ou mover a nota reescreve ligações o texto não aceita digitação: o aviso explica por quê. */}
    <p id={idOcupado} role="status" className={ocupado ? "mb-2 text-meta text-texto" : "sr-only"}>{ocupado ? "Atualizando a nota…" : ""}</p>
    {rascunhoDoBimo && <BarraDoBimo desabilitado={bloqueado || rascunho.estado.tipo === "gerando"} aoPedir={(acao) => { void rascunho.pedir(acao); }} />}
    <textarea ref={campo} value={texto} maxLength={1_000_000} readOnly={aguardandoRecuperacao || ocupado} aria-busy={ocupado}
      aria-describedby={ocupado ? idOcupado : aguardandoRecuperacao ? descricaoRecuperacao : undefined}
      aria-autocomplete={sugerir ? "list" : undefined} aria-controls={sugestoes.aberto ? sugestoes.idLista : undefined}
      aria-activedescendant={sugestoes.idDaOpcaoAtiva}
      onChange={(evento) => { aoMudar(evento.target.value); sugestoes.atualizar(true); }}
      onSelect={() => sugestoes.atualizar(false)} onBlur={sugestoes.fechar}
      onCompositionStart={sugestoes.aoComporInicio} onCompositionEnd={sugestoes.aoComporFim}
      aria-label={`Texto da nota ${titulo}, Markdown`} aria-keyshortcuts="Control+S Meta+S" spellCheck lang="pt-BR"
      onKeyDown={(evento) => {
        if (sugestoes.aoTeclar(evento)) return;
        // Esc cancela o pedido em andamento (com a lista de sugestões fechada, que já tratou o Esc dela acima).
        if (evento.key === "Escape" && rascunho.estado.tipo === "gerando") { evento.preventDefault(); rascunho.cancelar(); return; }
        if (combinaAtalho(evento.nativeEvent, "mod+s")) { evento.preventDefault(); evento.stopPropagation(); if (!aguardandoRecuperacao) void forcar({ checkpoint: true }); }
      }} className="block min-h-64 w-full resize-none overflow-hidden rounded-bloco border border-borda bg-painel p-2 text-base leading-relaxed text-texto outline-offset-2 [field-sizing:content] read-only:bg-painel-alt focus-visible:border-destaque md:text-corpo" />
    {sugestoes.aberto && <SugestoesDoEditor id={sugestoes.idLista} rotulo={rotuloDaLista(sugestoes.aberto.gatilho.tipo)} itens={sugestoes.aberto.sugestoes.map(paraItemDaLista)}
      indiceAtivo={sugestoes.aberto.indice} posicao={sugestoes.aberto.posicao} aoEscolher={sugestoes.escolher} />}
    <p role="status" className="sr-only"><span key={sugestoes.aviso.id}>{sugestoes.aviso.texto}</span></p>
    {rascunhoDoBimo && <>
      <CartaoDoRascunho estado={rascunho.estado} aoAceitar={rascunho.aceitar} aoDescartar={rascunho.descartar}
        aoTentarDeNovo={() => { void rascunho.tentarDeNovo(); }} aoCancelar={rascunho.cancelar} aoFechar={rascunho.fechar} />
      <p role="status" className="sr-only"><span key={rascunho.aviso.id}>{rascunho.aviso.texto}</span></p>
    </>}
  </>;
}
