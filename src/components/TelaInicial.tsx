"use client";

import type { IdDeNota } from "@/lib/types";
import MarcaBimo from "./MarcaBimo";
import { useId } from "react";
import { useNoMac } from "@/lib/usar-plataforma";

type Props = {
  recentes: { id: IdDeNota; titulo: string; pasta: string | null; conexoes: number }[];
  criarDisponivel: boolean;
  aoCriar(): void;
  aoIrParaNota(): void;
  aoAbrirGrafico(): void;
  aoPerguntarAoBimo(): void;
  aoAbrirNota(id: IdDeNota): void;
};

const interacao = "min-h-10 transition-[color,background-color,transform] [&:not([aria-disabled=true])]:hover:bg-painel-alt motion-safe:active:scale-[0.96] aria-disabled:cursor-not-allowed aria-disabled:opacity-50";

export default function TelaInicial(props: Props) {
  const idAviso = useId();
  const mac = useNoMac();
  const acoes = [
    { rotulo: "Criar nova nota", atalho: mac ? "Option N" : "Alt N", icone: "+", acao: props.aoCriar, desabilitada: !props.criarDisponivel },
    { rotulo: "Ir para nota", atalho: "Ctrl O", icone: "⌕", acao: props.aoIrParaNota },
    { rotulo: "Abrir o gráfico", atalho: "Ctrl G", icone: "◈", acao: props.aoAbrirGrafico },
    { rotulo: "Perguntar ao Bimo", atalho: "Ctrl J", icone: null, acao: props.aoPerguntarAoBimo },
  ];
  return (
    <div className="mx-auto w-full max-w-3xl bg-painel px-4 py-10 text-texto md:px-8 md:py-16">
      <div className="flex flex-col items-center text-center">
        <MarcaBimo tamanho={72} />
        <h1 className="mt-5 text-titulo-nota font-semibold text-balance">Abra uma nota para começar</h1>
        <p className="mt-2 max-w-md text-corpo text-pretty text-suave">Escolha uma nota na lista, crie uma nova ou peça ao Bimo para achar o que você já escreveu sobre um assunto.</p>
      </div>
      <div className="mx-auto mt-8 max-w-md overflow-hidden rounded-bloco border border-borda">
        {acoes.map((acao) => <button key={acao.rotulo} type="button" onClick={acao.acao} aria-disabled={acao.desabilitada} aria-describedby={acao.desabilitada ? idAviso : undefined} aria-keyshortcuts={acao.rotulo === "Criar nova nota" ? "Alt+N" : undefined} className={`flex w-full items-center gap-3 border-b border-borda px-4 py-2.5 text-left text-controle font-semibold text-destaque-texto last:border-b-0 ${interacao}`}>
          <span aria-hidden="true" className="w-5 text-center">{acao.icone ?? <MarcaBimo tamanho={18} />}</span><span className="flex-1">{acao.rotulo}</span><kbd aria-hidden="true" className="rounded-tag border border-borda bg-painel-alt px-2 py-0.5 text-meta text-texto">{acao.atalho}</kbd>
        </button>)}
        <p id={idAviso} className="sr-only">Criar notas não está disponível no modo somente leitura.</p>
      </div>
      <section aria-label="Notas recentes" className="mt-12">
        <h2 className="mb-3 text-secao font-semibold text-balance text-suave uppercase">Recentes</h2>
        {props.recentes.length === 0 ? <p className="text-corpo text-suave">Nenhuma nota aberta ainda.</p> : <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {props.recentes.map((nota) => <button key={nota.id} type="button" onClick={() => props.aoAbrirNota(nota.id)} className={`rounded-bloco border border-borda bg-painel p-4 text-left ${interacao}`}>
            <span className="flex items-start justify-between gap-2"><span className="text-corpo font-semibold text-balance">{nota.titulo}</span><span className="shrink-0 text-meta text-suave tabular-nums">◈ {nota.conexoes}</span></span>
            <span className="mt-2 block text-meta text-suave">{nota.pasta ?? "Raiz"}</span>
          </button>)}
        </div>}
      </section>
    </div>
  );
}
