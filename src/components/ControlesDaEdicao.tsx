"use client";
import { useEffect, useId, useRef, useState } from "react";
import type { EscolhaDaEdicao } from "@/lib/espaco-de-trabalho/usar-edicao-de-nota";

type Props = { conflito: boolean; recuperado: boolean; recusado?: boolean; mensagem?: string; editando?: boolean; ativo?: boolean; idAviso?: string; salvar?(): unknown; resolver(escolha: EscolhaDaEdicao): Promise<void>; aoResolver?(): void };
const botao = "min-h-10 rounded-full border border-borda bg-painel px-4 text-controle font-semibold transition-[background-color,transform] hover:bg-painel-alt motion-safe:active:scale-[0.96]";
export default function ControlesDaEdicao({ conflito, recuperado, recusado = false, mensagem, editando = false, ativo = true, idAviso, salvar, resolver, aoResolver }: Props) {
  const [erro, definirErro] = useState<string | null>(null);
  const [ocupado, definirOcupado] = useState(false);
  const [anuncio, definirAnuncio] = useState("");
  const identificador = useId();
  const tituloId = identificador + "-titulo";
  const descricaoId = idAviso ?? identificador + "-descricao";
  const restaurar = useRef<HTMLButtonElement>(null);
  const anuncioInicial = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const descricao = conflito ? "Esta nota mudou em outro lugar. O salvamento automático está pausado até você escolher. A sua versão continua neste dispositivo."
    : recuperado ? "Recuperamos alterações que não tinham sido salvas. Decida sobre o rascunho antes de editar."
    : recusado ? mensagem ?? "O servidor recusou o salvamento. Seu texto está preservado." : "";
  useEffect(() => {
    if (!descricao) return;
    const timer = setTimeout(() => definirAnuncio(descricao), 0);
    anuncioInicial.current = timer;
    if (recuperado && ativo) restaurar.current?.focus({ preventScroll: true });
    return () => clearTimeout(timer);
  }, [descricao, recuperado, ativo]);
  async function escolher(escolha: EscolhaDaEdicao, acionado: HTMLButtonElement) {
    if (ocupado) return;
    clearTimeout(anuncioInicial.current);
    definirOcupado(true); definirErro(null);
    try {
      await resolver(escolha);
      definirAnuncio(({ copiar: "Sua versão foi copiada", usar: "Versão salva restaurada", manter: "Sua versão foi enviada para salvar", restaurar: "Rascunho restaurado", descartar: "Rascunho descartado", tentar: "Nova tentativa solicitada" })[escolha]);
      if (escolha !== "copiar" && escolha !== "tentar") aoResolver?.();
    } catch { definirErro("Não foi possível concluir a ação. Sua versão foi preservada."); acionado.focus(); }
    finally { definirOcupado(false); }
  }
  const escolhas: [string, EscolhaDaEdicao][] = conflito
    ? [["Copiar minha versão", "copiar"], ["Usar a versão salva (descarta a minha)", "usar"], ["Manter minha versão (substitui a salva)", "manter"]]
    : recusado ? [["Copiar meu texto", "copiar"], ["Tentar salvar de novo", "tentar"]]
    : [["Restaurar rascunho", "restaurar"], ["Descartar rascunho", "descartar"]];
  return <>
    <p className="sr-only" role={conflito || recusado ? "alert" : "status"} aria-atomic="true">{anuncio}</p>
    {(conflito || recuperado || recusado) && <div role="group" aria-labelledby={tituloId} aria-describedby={descricaoId} className="sticky top-[var(--altura-navegacao,3.5rem)] z-20 mx-auto max-w-[720px] bg-painel px-5 pt-5 md:px-8 lg:top-0">
      <div className="rounded-bloco border border-borda bg-destaque-suave p-4 text-texto">
        <h2 id={tituloId} className="mb-2 font-semibold">{conflito ? "Conflito de edição" : recusado ? "Salvamento recusado" : "Recuperação de rascunho"}</h2>
        <p id={descricaoId} className="mb-3 text-corpo text-pretty">{descricao}</p>
        <div className="flex flex-wrap gap-2">{escolhas.map(([rotulo, escolha]) => <button key={escolha} ref={escolha === "restaurar" ? restaurar : undefined} aria-disabled={ocupado} type="button" className={botao} onClick={(evento) => { void escolher(escolha, evento.currentTarget); }}>{rotulo}</button>)}</div>
        {anuncio === "Sua versão foi copiada" && <p aria-hidden="true" className="mt-3">Copiada</p>}
        {erro && <p role="alert" className="mt-3">{erro}</p>}
      </div>
    </div>}
    {editando && <div className="mx-auto flex max-w-[720px] flex-wrap items-center gap-3 px-5 pt-4 text-meta text-texto md:px-8"><button type="button" className={botao} aria-disabled={conflito || recuperado || recusado} onClick={() => { if (!conflito && !recuperado && !recusado) void salvar?.(); }}>Salvar agora</button><span>Ctrl+S / ⌘S para salvar agora</span></div>}
  </>;
}
