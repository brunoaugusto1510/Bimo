"use client";

import { useEffect, useMemo, useState } from "react";
import type { NotaParaArvore } from "@/lib/arvore-de-notas";
import { normalizarTexto } from "@/lib/caminho-da-nota";
import { MAXIMO_DE_NOTAS_DE_CONTEXTO } from "@/lib/contexto-de-notas";
import Dialogo from "./Dialogo";

const ACAO = "min-h-10 rounded-full px-3 text-controle text-texto transition-[background-color,transform] hover:bg-painel-alt disabled:opacity-50 motion-safe:enabled:active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-destaque";
const NOTAS_VAZIAS: NotaParaArvore[] = [];

export default function ContextoDoChat({ ids, notas = NOTAS_VAZIAS, abertas = [], ocupado, indisponiveis, aoMudar, aoAbrir }: {
  ids: string[]; notas?: NotaParaArvore[]; abertas?: string[]; ocupado: boolean; indisponiveis: string[];
  aoMudar(ids: string[]): void; aoAbrir?: (id: string) => void;
}) {
  const [selecionando, selecionar] = useState(false);
  const porId = new Map(notas.map((n) => [n.id, n]));
  return <div className="mx-auto mb-3 max-w-2xl">
    <p className="mb-1 text-controle font-semibold">Contexto desta conversa</p>
    <div className="relative flex max-h-40 flex-wrap items-center gap-1.5 overflow-y-auto">
      {ids.map((id) => {
        const nota = porId.get(id);
        const indisponivel = indisponiveis.includes(id);
        const titulo = nota?.titulo ?? "Nota anexada";
        return <div key={id} className={`inline-flex max-w-full items-center rounded-full border ${indisponivel ? "border-erro bg-erro-suave" : "border-destaque-suave-borda bg-destaque-suave"}`}>
          <button type="button" disabled={!aoAbrir || indisponivel} onClick={() => aoAbrir?.(id)} title={nota?.pasta ?? "Notas"} className={`${ACAO} flex min-w-0 items-center gap-1.5`}>
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 3h8l4 4v14H6zM14 3v5h4M9 12h6M9 16h6" /></svg>
            <span className="truncate">{titulo}{nota?.pasta ? ` · ${nota.pasta}` : ""}{indisponivel ? " · Indisponível" : ""}</span>
          </button>
          <button type="button" className={`${ACAO} min-w-10 shrink-0 px-2`} aria-label={`Remover ${titulo} do contexto`} disabled={ocupado} onClick={() => aoMudar(ids.filter((outro) => outro !== id))}>×</button>
        </div>;
      })}
      <button type="button" className={`${ACAO} border border-borda`} disabled={ocupado} onClick={() => selecionar(true)}>+ Adicionar notas</button>
    </div>
    {ids.length > 0 && <p className="mt-1 text-meta text-suave">As notas permanecem até você removê-las.</p>}
    {indisponiveis.length > 0 && <p role="alert" className="mt-1 text-controle text-erro">Há notas indisponíveis. Remova-as ou restaure-as na lixeira antes de enviar.</p>}
    {selecionando && <SeletorDeNotas ids={ids} notas={notas} abertas={abertas} aoFechar={() => selecionar(false)} aoAdicionar={(novos) => { aoMudar(novos); selecionar(false); }} />}
  </div>;
}

function SeletorDeNotas({ ids, notas, abertas, aoFechar, aoAdicionar }: {
  ids: string[]; notas: NotaParaArvore[]; abertas: string[]; aoFechar(): void; aoAdicionar(ids: string[]): void;
}) {
  const [consulta, consultar] = useState("");
  const [selecionadas, selecionar] = useState(ids);
  const [resultados, definirResultados] = useState<NotaParaArvore[]>([]);
  const [buscando, buscar] = useState(false);
  const [erro, definirErro] = useState("");
  useEffect(() => {
    const controle = new AbortController();
    if (consulta.trim().length < 2) return;
    const temporizador = setTimeout(async () => {
      buscar(true);
      definirErro("");
      try {
        const resposta = await fetch(`/api/notas/busca?q=${encodeURIComponent(consulta.trim())}&limite=20`, { signal: controle.signal });
        if (!resposta.ok) throw new Error();
        const dados = await resposta.json();
        if (!controle.signal.aborted) definirResultados(dados.resultados ?? []);
      } catch {
        if (!controle.signal.aborted) definirErro("Não consegui buscar no conteúdo. Você ainda pode selecionar pelo título.");
      } finally { if (!controle.signal.aborted) buscar(false); }
    }, 250);
    return () => { clearTimeout(temporizador); controle.abort(); };
  }, [consulta]);
  const visiveis = useMemo(() => {
    const termo = normalizarTexto(consulta.trim());
    const porId = new Map(notas.filter((n) => !termo || normalizarTexto(`${n.titulo} ${n.pasta ?? ""}`).includes(termo)).map((n) => [n.id, n]));
    if (termo.length >= 2) for (const nota of resultados) if (!porId.has(nota.id)) porId.set(nota.id, nota);
    return [...porId.values()].sort((a, b) => Number(abertas.includes(b.id)) - Number(abertas.includes(a.id)) || a.titulo.localeCompare(b.titulo, "pt-BR"));
  }, [consulta, notas, resultados, abertas]);
  return <Dialogo titulo="Adicionar notas ao contexto" aoFechar={aoFechar}>
    <p className="mb-3 text-controle text-texto">O Bimo usará a última versão salva a cada pedido. Rascunhos ainda não salvos ficam de fora.</p>
    <label className="block text-controle">Buscar notas
      <input data-foco-inicial type="search" value={consulta} onChange={(e) => { consultar(e.target.value); definirResultados([]); buscar(false); definirErro(""); }} placeholder="Título ou conteúdo" className="mt-1 min-h-10 w-full rounded-bloco border border-borda bg-fundo px-3 text-texto outline-none focus:border-destaque" />
    </label>
    <div role="status" className="mt-2 text-controle text-texto">{buscando ? "Buscando no conteúdo…" : erro}</div>
    <ul className="relative mt-2 max-h-64 overflow-y-auto divide-y divide-borda">
      {visiveis.map((nota) => {
        const marcada = selecionadas.includes(nota.id);
        return <li key={nota.id}><label className="flex min-h-10 cursor-pointer items-center gap-3 py-2 text-controle">
          <input type="checkbox" checked={marcada} disabled={!marcada && selecionadas.length >= MAXIMO_DE_NOTAS_DE_CONTEXTO} onChange={() => selecionar((atuais) => marcada ? atuais.filter((id) => id !== nota.id) : [...atuais, nota.id])} className="accent-destaque" />
          <span className="min-w-0"><span className="block truncate text-texto">{nota.titulo}</span><span className="block text-meta text-suave">{nota.pasta ?? "Notas"}{abertas.includes(nota.id) ? " · Aberta" : ""}</span></span>
        </label></li>;
      })}
    </ul>
    {!visiveis.length && <p className="py-4 text-controle">Nenhuma nota encontrada.</p>}
    <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
      <p role="status" className="text-controle tabular-nums">{selecionadas.length} de 10 selecionadas</p>
      <div className="flex gap-2"><button type="button" className={ACAO} onClick={aoFechar}>Cancelar</button><button type="button" onClick={() => aoAdicionar(selecionadas)} className="min-h-10 rounded-full bg-destaque px-4 text-controle text-sobre-destaque transition-[background-color,transform] hover:bg-destaque-hover motion-safe:active:scale-[0.96]">Adicionar</button></div>
    </div>
  </Dialogo>;
}
