"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import type { IdDeNota } from "@/lib/types";
import { buscarPorTitulo, type Intervalo, type NotaParaBusca } from "@/lib/busca-por-titulo";
import { buscarNoConteudo } from "@/lib/cliente-de-notas";

type Props = {
  aberta: boolean;
  notas: NotaParaBusca[];
  recentes: IdDeNota[];
  podeCriar: boolean;
  pastaDaCriacao: string | null;
  aoFechar(): void;
  aoAbrir(id: IdDeNota, opcoes: { novaAba: boolean }): void;
  aoCriar(titulo: string, pasta: string | null): void;
};

type ResultadosNoConteudo = Awaited<ReturnType<typeof buscarNoConteudo>>;
const interacao = "min-h-10 transition-[color,background-color,transform] motion-safe:active:scale-[0.96]";
const normalizar = (texto: string) => texto.trim().normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("pt-BR");

function destacar(titulo: string, intervalos: Intervalo[]): ReactNode[] {
  const partes: ReactNode[] = [];
  let cursor = 0;
  for (const [inicio, fim] of intervalos) {
    partes.push(titulo.slice(cursor, inicio));
    partes.push(<strong key={inicio} className="font-semibold text-destaque-texto">{titulo.slice(inicio, fim)}</strong>);
    cursor = fim;
  }
  partes.push(titulo.slice(cursor));
  return partes;
}

/** Montar só quando aberta reinicia a consulta e cancela todo trabalho ao fechar. */
export default function PaletaIrParaNota(props: Props) {
  return props.aberta ? <DialogoIrParaNota {...props} /> : null;
}

function DialogoIrParaNota({ notas, recentes, podeCriar, pastaDaCriacao, aoFechar, aoAbrir, aoCriar }: Props) {
  const [consulta, definirConsulta] = useState("");
  const [indice, definirIndice] = useState(0);
  const [conteudo, definirConteudo] = useState<{ consulta: string; resultados: ResultadosNoConteudo } | null>(null);
  const campo = useRef<HTMLInputElement>(null);
  const dialogo = useRef<HTMLDivElement>(null);
  const focoAnterior = useRef<HTMLElement | null>(null);
  const id = useId();
  const consultaAparada = consulta.trim();
  const resultados = buscarPorTitulo(notas, consulta, recentes);
  const indiceAtivo = resultados.length ? Math.min(indice, resultados.length - 1) : -1;
  const podeOferecerCriacao = consultaAparada.length > 0 && !notas.some((nota) => normalizar(nota.titulo) === normalizar(consultaAparada));
  const resultadosNoConteudo = conteudo?.consulta === consultaAparada ? conteudo.resultados : [];

  useEffect(() => {
    focoAnterior.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    campo.current?.focus();
    return () => { focoAnterior.current?.focus(); };
  }, []);

  useEffect(() => {
    if (consultaAparada.length < 2) return;
    const controlador = new AbortController();
    let vigente = true;
    const temporizador = window.setTimeout(async () => {
      try {
        const encontrados = await buscarNoConteudo(consultaAparada, 5, controlador.signal);
        if (vigente && !controlador.signal.aborted) definirConteudo({ consulta: consultaAparada, resultados: encontrados.slice(0, 5) });
      } catch {
        // A busca no conteúdo é complementar: falhas não interrompem a busca local.
      }
    }, 250);
    return () => { vigente = false; window.clearTimeout(temporizador); controlador.abort(); };
  }, [consultaAparada]);

  useEffect(() => {
    if (indiceAtivo >= 0) document.getElementById(`${id}-opcao-${indiceAtivo}`)?.scrollIntoView({ block: "nearest" });
  }, [indiceAtivo, consulta, id]);

  function criar() {
    if (podeCriar && podeOferecerCriacao) aoCriar(consultaAparada, pastaDaCriacao);
  }

  function aoTeclar(evento: KeyboardEvent<HTMLDivElement>) {
    if (evento.key === "Escape") { evento.preventDefault(); evento.stopPropagation(); aoFechar(); return; }
    if (evento.key === "Tab") {
      const focaveis = Array.from(dialogo.current?.querySelectorAll<HTMLElement>('input, button:not(:disabled):not([tabindex="-1"]), [tabindex="0"]') ?? []);
      evento.preventDefault();
      const atual = focaveis.indexOf(document.activeElement as HTMLElement);
      const proximo = atual < 0 ? (evento.shiftKey ? focaveis.length - 1 : 0) : (atual + (evento.shiftKey ? -1 : 1) + focaveis.length) % focaveis.length;
      focaveis[proximo]?.focus();
      return;
    }
    if (evento.nativeEvent.isComposing) return;
    if (evento.key === "Enter" && evento.ctrlKey) { evento.preventDefault(); criar(); return; }
    if (evento.target !== campo.current || evento.nativeEvent.isComposing) return;
    if (evento.key === "ArrowDown" || evento.key === "ArrowUp") {
      evento.preventDefault();
      if (resultados.length) definirIndice((indiceAtivo + (evento.key === "ArrowDown" ? 1 : -1) + resultados.length) % resultados.length);
    } else if (evento.key === "Enter") {
      evento.preventDefault();
      if (indiceAtivo >= 0) aoAbrir(resultados[indiceAtivo].nota.id, { novaAba: evento.shiftKey });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-texto/30 px-3 py-6 md:px-4 md:pt-28">
      <div ref={dialogo} role="dialog" aria-modal="true" aria-label="Ir para nota" onKeyDown={aoTeclar} className="relative w-full max-w-2xl overflow-hidden rounded-painel border border-borda bg-painel text-texto shadow-foco motion-safe:animate-entrada">
        <div className="flex items-center gap-3 border-b border-borda px-4">
          <span aria-hidden="true" className="text-suave">⌕</span>
          <label htmlFor={`${id}-busca`} className="sr-only">Buscar nota pelo nome</label>
          <input ref={campo} id={`${id}-busca`} type="search" role="combobox" aria-autocomplete="list" aria-expanded="true" aria-controls={`${id}-resultados`} aria-activedescendant={indiceAtivo >= 0 ? `${id}-opcao-${indiceAtivo}` : undefined} value={consulta} onChange={(evento) => {
            definirConsulta(evento.target.value); definirIndice(0); definirConteudo(null);
          }} className="h-14 min-w-0 flex-1 bg-painel text-corpo outline-none" />
          <button type="button" aria-label="Fechar paleta" onClick={aoFechar} className={`min-w-10 rounded-full px-2 text-meta text-suave hover:bg-painel-alt ${interacao}`}><kbd>Esc</kbd></button>
        </div>
        <div className="max-h-[60dvh] overflow-y-auto p-2">
          <h2 className="px-3 py-2 text-secao font-semibold text-balance text-suave uppercase">Notas</h2>
          <div id={`${id}-resultados`} role="listbox" aria-label="Resultados">
            {resultados.map(({ nota, intervalos }, posicao) => <button key={nota.id} id={`${id}-opcao-${posicao}`} type="button" role="option" aria-selected={posicao === indiceAtivo} tabIndex={-1} onClick={(evento) => aoAbrir(nota.id, { novaAba: evento.shiftKey })} className={`flex w-full items-center gap-3 rounded-bloco px-3 py-2 text-left text-controle ${interacao} ${posicao === indiceAtivo ? "bg-destaque-suave" : "hover:bg-painel-alt"}`}>
              <span aria-hidden="true" className="text-suave">◈</span><span className="min-w-0 flex-1 truncate">{destacar(nota.titulo, intervalos)}</span><span className="max-w-32 truncate text-meta text-suave">{nota.pasta ?? "Raiz"}</span>
            </button>)}
          </div>
          {resultados.length === 0 && <p className="px-3 py-2 text-meta text-suave">Nenhuma nota encontrada pelo nome.</p>}
          {podeOferecerCriacao && <section aria-label="Criar" className="mt-2">
            <h2 className="px-3 py-2 text-secao font-semibold text-balance text-suave uppercase">Criar</h2>
            <button type="button" disabled={!podeCriar} title={!podeCriar ? "Criar notas não está disponível no modo somente leitura." : undefined} onClick={criar} className={`w-full rounded-bloco px-3 py-2 text-left text-controle hover:bg-destaque-suave disabled:cursor-not-allowed disabled:text-suave ${interacao}`}>Criar a nota “{consultaAparada}” em {pastaDaCriacao ?? "Raiz"}</button>
          </section>}
          {consultaAparada.length >= 2 && <section aria-label="No conteúdo" className="mt-2">
            <h2 className="px-3 py-2 text-secao font-semibold text-balance text-suave uppercase">No conteúdo</h2>
            {resultadosNoConteudo.map((nota) => <button key={nota.id} type="button" onClick={(evento) => aoAbrir(nota.id, { novaAba: evento.shiftKey })} className={`block w-full rounded-bloco px-3 py-2 text-left text-controle hover:bg-painel-alt ${interacao}`}>
              <span className="flex justify-between gap-3"><span className="font-semibold">{nota.titulo}</span><span className="text-meta text-suave">{nota.pasta ?? "Raiz"}</span></span><span className="mt-1 block text-meta text-suave">{nota.trecho}</span>
            </button>)}
          </section>}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-borda bg-painel-alt px-4 py-3 text-meta text-suave">
          <span><kbd>↑↓</kbd> navegar</span><span><kbd>↵</kbd> abrir</span><span><kbd>Shift ↵</kbd> abrir ao lado</span><span><kbd>Ctrl ↵</kbd> criar nota nova</span>
        </div>
      </div>
    </div>
  );
}


