"use client";
import { useEffect, useRef, useState } from "react";
import type { DadosDaPagina } from "@/lib/servico-de-notas";
import { EVENTO_NOTA_SALVA } from "@/lib/espaco-de-trabalho/usar-edicao-de-nota";
import { EVENTO_NOTA_CRIADA } from "@/lib/espaco-de-trabalho/usar-criacao-de-nota";

/** Atualiza somente dados: falhas nunca substituem a árvore que contém a conversa e os editores. */
export default function AtualizadorDasNotas({ aoAtualizar }: { aoAtualizar?: (dados: DadosDaPagina, iniciadoEm: number) => void }) {
  const callback = useRef(aoAtualizar);
  const [aviso, definirAviso] = useState("");
  useEffect(() => { callback.current = aoAtualizar; }, [aoAtualizar]);
  useEffect(() => {
    let ultima = -Infinity;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let montado = true;
    let voo = false;
    let urgente = false;
    let controle: AbortController | undefined;
    async function atualizar() {
      timer = undefined; ultima = Date.now(); voo = true;
      const iniciadoEm = ultima;
      controle = new AbortController();
      const limite = setTimeout(() => controle?.abort(), 20000);
      try {
        const resposta = await fetch("/api/grafo?comArvore=1", { signal: controle.signal, cache: "no-store" });
        if (!resposta.ok) throw new Error("Falha ao atualizar");
        const dados: DadosDaPagina = await resposta.json();
        if (montado) { callback.current?.(dados, iniciadoEm); definirAviso(""); }
      } catch { if (montado) definirAviso("Não foi possível atualizar as notas. Os dados anteriores continuam na tela."); }
      finally { clearTimeout(limite); voo = false; if (urgente && montado) { urgente = false; void atualizar(); } }
    }
    function aoSalvar() {
      if (timer !== undefined) return;
      const restante = 10000 - (Date.now() - ultima);
      if (restante <= 0 && !voo) void atualizar(); else timer = setTimeout(() => { if (voo) { timer = undefined; aoSalvar(); } else void atualizar(); }, Math.max(100, restante));
    }
    function aoCriar() {
      clearTimeout(timer); timer = undefined;
      if (voo) urgente = true; else void atualizar();
    }
    window.addEventListener(EVENTO_NOTA_CRIADA, aoCriar);
    window.addEventListener(EVENTO_NOTA_SALVA, aoSalvar);
    window.addEventListener("bimo:nota-alterada-pelo-agente", aoSalvar);
    return () => { montado = false; window.removeEventListener(EVENTO_NOTA_CRIADA, aoCriar); controle?.abort(); clearTimeout(timer); window.removeEventListener(EVENTO_NOTA_SALVA, aoSalvar); window.removeEventListener("bimo:nota-alterada-pelo-agente", aoSalvar); };
  }, []);
  return <p role="status" className={aviso ? "border-b border-borda bg-painel px-4 py-2 text-meta text-texto" : "sr-only"}>{aviso}</p>;
}
