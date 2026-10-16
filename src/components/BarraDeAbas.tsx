"use client";

import { useEffect, useRef } from "react";

type Props = {
  abas: { chave: string; titulo: string }[];
  ativa: string;
  aoAtivar(chave: string): void;
  aoFechar(chave: string): void;
  aoNovaAba(): void;
};

const interacao = "transition-[color,background-color,transform] hover:bg-painel-alt motion-safe:active:scale-[0.96]";

export default function BarraDeAbas({ abas, ativa, aoAtivar, aoFechar, aoNovaAba }: Props) {
  const botoes = useRef(new Map<string, HTMLButtonElement>());
  const todas = [{ chave: "grafico", titulo: "Gráfico" }, ...abas.filter((aba) => aba.chave !== "grafico")];

  const fechamentoPendente = useRef(false);

  useEffect(() => {
    if (fechamentoPendente.current) {
      botoes.current.get(ativa)?.focus();
      fechamentoPendente.current = false;
    }
  }, [ativa, abas]);

  function fechar(chave: string) {
    fechamentoPendente.current = true;
    aoFechar(chave);
  }

  function mover(indice: number) {
    const aba = todas[(indice + todas.length) % todas.length];
    aoAtivar(aba.chave);
    botoes.current.get(aba.chave)?.focus();
  }

  return (
    <div className="flex overflow-x-auto border-b border-borda bg-painel-alt px-2 pt-2 text-controle">
      <div className="grid auto-cols-max grid-flow-col items-end gap-x-0.5">
        <div role="tablist" aria-label="Abas abertas" className="contents">
          {todas.map((aba, indice) => (
            <button key={aba.chave} style={{ gridColumn: indice + 1, gridRow: 1 }} type="button" role="tab" aria-selected={ativa === aba.chave} aria-controls={ativa === aba.chave ? `painel-${aba.chave}` : undefined} id={`aba-${aba.chave}`} tabIndex={ativa === aba.chave ? 0 : -1}
              ref={(elemento) => { if (elemento) botoes.current.set(aba.chave, elemento); else botoes.current.delete(aba.chave); }}
              onAuxClick={(evento) => {
                if (evento.button === 1 && aba.chave !== "grafico") { evento.preventDefault(); fechar(aba.chave); }
              }}
              onClick={() => aoAtivar(aba.chave)} onKeyDown={(evento) => {
                const movimentos: Record<string, number> = { ArrowLeft: indice - 1, ArrowRight: indice + 1, Home: 0, End: todas.length - 1 };
                if (evento.key in movimentos) { evento.preventDefault(); mover(movimentos[evento.key]); }
                if (evento.key === "Delete" && aba.chave !== "grafico") { evento.preventDefault(); fechar(aba.chave); }
              }} className={`h-10 max-w-[240px] truncate rounded-t-bloco border px-3 ${aba.chave !== "grafico" ? "pr-12" : ""} ${ativa === aba.chave ? "-mb-px border-b-painel border-x-borda border-t-borda bg-painel font-semibold" : "border-transparent text-suave"} ${interacao}`}>
              {aba.chave === "grafico" && <span aria-hidden="true" className="mr-2">◈</span>}{aba.titulo}
            </button>
          ))}
        </div>
        {todas.map((aba, indice) => aba.chave !== "grafico" && <button key={aba.chave} style={{ gridColumn: indice + 1, gridRow: 1 }} type="button" tabIndex={ativa === aba.chave ? 0 : -1} aria-label={`Fechar ${aba.titulo}`} onClick={() => fechar(aba.chave)} className={`z-10 h-10 w-10 justify-self-end rounded-full text-suave ${interacao}`}><span aria-hidden="true">✕</span></button>)}
        <button type="button" aria-label="Nova aba" title="Nova aba" onClick={aoNovaAba} className={`h-10 w-10 shrink-0 rounded-full text-suave ${interacao}`}>+</button>
      </div>
    </div>
  );
}
