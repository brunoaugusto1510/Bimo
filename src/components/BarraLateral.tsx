"use client";

import { useMemo, useState } from "react";
import { contarNotas, filtrarArvore } from "@/lib/arvore-de-notas";
import type { IdDeNota, ItemDeNotas } from "@/lib/types";

type Props = {
  itens: ItemDeNotas[];
  /** Id da nota atualmente destacada, ou null se nenhuma */
  notaSelecionada: IdDeNota | null;
  onSelecionarNota: (nota: { id: IdDeNota; nome: string }) => void;
};

/** Recuo por nível de pasta, em pixels. */
const RECUO_POR_NIVEL = 16;
/** Recuos-base do design system (tela "Nota"): a nota entra mais que a pasta, para alinhar com o nome dela e não com o caret. */
const RECUO_DA_PASTA = 4;
const RECUO_DA_NOTA = 10;

/**
 * Estrutura das notas, como na tela "Nota" do design system: busca no topo,
 * rótulo de seção com o total, pastas com caret e contagem, e a nota
 * selecionada em azul.
 */
export default function BarraLateral({ itens, notaSelecionada, onSelecionarNota }: Props) {
  const [consulta, setConsulta] = useState("");

  const totalDeNotas = useMemo(() => contarNotas(itens), [itens]);
  const itensVisiveis = useMemo(() => filtrarArvore(itens, consulta), [itens, consulta]);
  const buscando = consulta.trim() !== "";
  const notasEncontradas = buscando ? contarNotas(itensVisiveis) : totalDeNotas;

  return (
    // "Superfície Alt" do design system: a barra lateral fica um tom abaixo do painel do chat.
    <aside className="flex h-full flex-col border-r border-borda bg-painel-alt">
      <div className="px-3 pt-3">
        <label className="relative block">
          <span className="sr-only">Buscar nas notas</span>
          <span
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm"
          >
            🔍
          </span>
          <input
            type="search"
            value={consulta}
            onChange={(evento) => setConsulta(evento.target.value)}
            placeholder="Buscar nas notas..."
            className="w-full rounded-card border border-borda bg-painel py-2.5 pr-3 pl-9 text-controle outline-none placeholder:text-suave focus:border-destaque"
          />
        </label>
      </div>

      <div className="flex items-center justify-between px-4 pt-4 pb-1.5">
        <h2 className="text-secao font-semibold tracking-[0.08em] text-suave uppercase">
          Estrutura das notas
        </h2>
        <span className="text-xs text-suave tabular-nums">
          {buscando
            ? `${notasEncontradas} de ${totalDeNotas} notas`
            : `${totalDeNotas} nota${totalDeNotas === 1 ? "" : "s"}`}
        </span>
      </div>

      {/* `relative`: os `sr-only` (position: absolute) das linhas precisam de um
          ancestral posicionado aqui dentro, senão escapam do recorte do scroll e
          alongam o documento inteiro — e o scrollIntoView do chat passa a rolar a página. */}
      <nav aria-label="Pastas e notas" className="relative flex-1 overflow-y-auto px-2 pb-2">
        {itensVisiveis.length === 0 ? (
          <p className="px-2 py-4 text-sm text-suave">
            Nenhuma nota encontrada para “{consulta.trim()}”.
          </p>
        ) : (
          itensVisiveis.map((item) => (
            <ItemDaArvore
              key={chaveDoItem(item)}
              item={item}
              nivel={0}
              forcarAberta={buscando}
              notaSelecionada={notaSelecionada}
              onSelecionarNota={onSelecionarNota}
            />
          ))
        )}
      </nav>
    </aside>
  );
}

/**
 * Um item da árvore, que desenha a si mesmo e — se for pasta — desenha os
 * filhos chamando este mesmo componente. É recursão: o mesmo código serve
 * para qualquer profundidade de pastas, sem precisar saber quantas existem.
 */
function ItemDaArvore({
  item,
  nivel,
  forcarAberta,
  notaSelecionada,
  onSelecionarNota,
}: {
  item: ItemDeNotas;
  nivel: number;
  /** Durante a busca todas as pastas abrem — o resultado costuma morar numa pasta fechada. */
  forcarAberta: boolean;
  notaSelecionada: IdDeNota | null;
  onSelecionarNota: Props["onSelecionarNota"];
}) {
  // Pastas de primeiro nível começam abertas; as de dentro, fechadas.
  const [aberta, setAberta] = useState(nivel === 0);

  // Cada nível entra 16px para a direita. Vai no `style` porque o Tailwind
  // não consegue gerar classes a partir de um valor calculado em runtime.
  const recuoBase = nivel * RECUO_POR_NIVEL;

  if (item.tipo === "nota") {
    const selecionada = notaSelecionada === item.id;

    return (
      <button
        type="button"
        style={{ paddingLeft: `${recuoBase + RECUO_DA_NOTA}px` }}
        onClick={() => onSelecionarNota({ id: item.id, nome: item.nome })}
        aria-current={selecionada ? "true" : undefined}
        // Linhas mais altas no celular (dedo) e compactas no desktop (cursor).
        className={`flex w-full items-center gap-2 rounded-tag py-2.5 pr-2 text-left text-controle transition-colors hover:bg-painel md:py-1.5 ${
          selecionada ? "font-semibold text-destaque-texto" : "text-texto"
        }`}
      >
        <span aria-hidden className="shrink-0">
          📄
        </span>
        <span className="truncate">{item.nome}</span>
      </button>
    );
  }

  const estaAberta = forcarAberta || aberta;
  const totalDeNotas = contarNotas(item.filhos);

  return (
    <div>
      <button
        type="button"
        style={{ paddingLeft: `${recuoBase + RECUO_DA_PASTA}px` }}
        onClick={() => setAberta((estava) => !estava)}
        aria-expanded={estaAberta}
        className="flex w-full items-center gap-2 rounded-tag py-2.5 pr-2 text-left text-sm font-medium transition-colors hover:bg-painel md:py-1.5"
      >
        <span aria-hidden className="w-2.5 shrink-0 text-[10px] text-suave">
          {estaAberta ? "▾" : "▸"}
        </span>
        <span className="truncate">{item.nome}</span>
        <span className="ml-auto shrink-0 text-xs font-normal text-suave tabular-nums">
          {totalDeNotas}
          <span className="sr-only"> nota{totalDeNotas === 1 ? "" : "s"}</span>
        </span>
      </button>

      {estaAberta && (
        <div>
          {item.filhos.map((filho) => (
            <ItemDaArvore
              key={chaveDoItem(filho)}
              item={filho}
              nivel={nivel + 1}
              forcarAberta={forcarAberta}
              notaSelecionada={notaSelecionada}
              onSelecionarNota={onSelecionarNota}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** O React precisa de uma chave estável por item de lista. */
function chaveDoItem(item: ItemDeNotas): string {
  return item.tipo === "nota" ? `nota:${item.id}` : `pasta:${item.caminho}`;
}
