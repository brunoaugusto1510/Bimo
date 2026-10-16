"use client";

import type { IdDeNota } from "@/lib/types";
import type { DestinoDeLigacao, LigacaoDeEntrada } from "@/lib/indice-de-ligacoes";
import type { TituloDoTexto } from "@/lib/markdown-da-nota";
import MarcaBimo from "./MarcaBimo";
import BimoPensando from "./BimoPensando";

type Props = {
  estado: "carregando" | "pronto" | "erro";
  sugestao: { id: IdDeNota; titulo: string } | null;
  entradas: LigacaoDeEntrada[];
  saidas: DestinoDeLigacao[];
  estrutura: TituloDoTexto[];
  podeInserir: boolean;
  aoAbrirNota(id: IdDeNota): void;
  aoIrParaLinha(linha: number): void;
  aoInserirSugestao(): void;
  aoDescartarSugestao(): void;
  aoPerguntarAoBimo(): void;
};

const interacao = "min-h-10 transition-[color,background-color,transform] motion-safe:active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50";
const tituloDaSecao = "text-secao font-semibold text-suave uppercase text-balance";
const recuos = ["pl-0", "pl-4", "pl-8", "pl-12", "pl-16", "pl-20"];

export default function PainelLateralDaNota(props: Props) {
  const resolvidas = props.saidas.filter((saida) => saida.tipo === "nota");
  const pendentes = props.saidas.filter((saida) => saida.tipo === "nao-resolvida");
  return (
    <aside aria-label="Painel lateral" className="flex w-full flex-col gap-6 border-l border-borda bg-fundo p-4 text-controle md:max-w-80">
      <section aria-label="Sugestão do Bimo" className="rounded-bloco border border-borda bg-destaque-suave p-4">
        <h2 className="mb-2 flex items-center gap-2 text-controle font-semibold text-balance text-destaque-texto"><MarcaBimo tamanho={16} />Sugestão do Bimo</h2>
        {props.estado === "carregando" ? <BimoPensando texto="Buscando ligações…" /> : props.estado === "erro" ? <p>Não consegui carregar as ligações.</p> : props.sugestao ? <>
          <p className="mb-3 text-pretty">Você cita “{props.sugestao.titulo}” no texto sem ligar a essa nota.</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={!props.podeInserir} title={!props.podeInserir ? "Inserir ligações não está disponível no modo somente leitura." : undefined} onClick={props.aoInserirSugestao} className={`rounded-full bg-destaque px-4 font-semibold text-sobre-destaque hover:bg-destaque-hover ${interacao}`}>+ Inserir</button>
            <button type="button" onClick={props.aoDescartarSugestao} className={`rounded-full px-3 hover:bg-painel ${interacao}`}>Descartar</button>
          </div>
        </> : <button type="button" onClick={props.aoPerguntarAoBimo} className={`rounded-full border border-destaque-texto px-3 font-semibold text-destaque-texto hover:bg-painel ${interacao}`}>Perguntar ao Bimo</button>}
      </section>
      <section aria-label="Ligações de entrada">
        <div className="mb-2 flex items-center justify-between gap-2"><h2 className={tituloDaSecao}>Ligações de entrada</h2><span className="text-meta text-suave tabular-nums">{props.entradas.length}</span></div>
        {props.entradas.length === 0 ? <p className="text-meta text-suave">Nenhuma nota liga a esta ainda.</p> : <ul className="space-y-2">{props.entradas.map((entrada) => <li key={entrada.id}><button type="button" onClick={() => props.aoAbrirNota(entrada.id)} className={`w-full rounded-bloco border border-borda bg-painel px-3 py-2 text-left hover:bg-painel-alt ${interacao}`}><span className="block font-semibold">{entrada.titulo}</span><span className="mt-1 block text-meta text-suave">{entrada.trecho}</span></button></li>)}</ul>}
      </section>
      <section aria-label="Ligações de saída">
        <div className="mb-2 flex items-center justify-between gap-2"><h2 className={tituloDaSecao}>Ligações de saída</h2><span className="text-meta text-suave tabular-nums">{props.saidas.length}</span></div>
        {props.saidas.length === 0 && <p className="text-meta text-suave">Esta nota ainda não tem ligações.</p>}
        <ul>{resolvidas.map((saida) => <li key={saida.id}><button type="button" onClick={() => props.aoAbrirNota(saida.id)} className={`w-full rounded-tag px-2 text-left text-destaque-texto hover:bg-destaque-suave ${interacao}`}><span aria-hidden="true">◈ </span>{saida.titulo}</button></li>)}</ul>
        {pendentes.length > 0 && <ul aria-label="Ligações ainda não resolvidas" className="mt-2 border-t border-borda pt-2 text-suave">{pendentes.map((saida) => <li key={saida.alvo} className="py-2"><span aria-hidden="true">◈ </span>{saida.titulo} <span className="text-meta">— ainda não existe</span></li>)}</ul>}
      </section>
      <section aria-label="Estrutura">
        <h2 className={`mb-2 ${tituloDaSecao}`}>Estrutura</h2>
        {props.estrutura.length === 0 ? <p className="text-meta text-suave">Nenhum título nesta nota.</p> : <ul>{props.estrutura.map((titulo) => <li key={titulo.linha}><button type="button" onClick={() => props.aoIrParaLinha(titulo.linha)} className={`w-full rounded-tag text-left hover:bg-painel-alt ${recuos[Math.max(0, Math.min(5, titulo.nivel - 1))]} ${interacao}`}>{titulo.texto}</button></li>)}</ul>}
      </section>
    </aside>
  );
}
