"use client";
import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import type { Intervalo } from "@/lib/busca-por-titulo";
import type { SugestaoDeLigacao } from "@/lib/edicao/sugestoes-de-ligacao";
import { idDaOpcao } from "@/lib/espaco-de-trabalho/usar-sugestoes-do-editor";

type Props = {
  /** O `id` da lista: o editor o liga ao campo por `aria-controls`. */
  id: string;
  sugestoes: readonly SugestaoDeLigacao[];
  indiceAtivo: number;
  /** Onde abrir, em px, a partir do `<article>` que o contém: abaixo do cursor (`topo`) ou acima dele (`base`). */
  posicao: { topo?: number; base?: number; esquerda: number };
  aoEscolher(indice: number): void;
};

/** O título com o que a consulta casou em destaque; o texto lido é o mesmo, só o negrito muda. */
function TituloComDestaque({ titulo, intervalos }: { titulo: string; intervalos: readonly Intervalo[] }) {
  const partes: ReactNode[] = [];
  let cursor = 0;
  intervalos.forEach(([inicio, fim], indice) => {
    if (inicio > cursor) partes.push(titulo.slice(cursor, inicio));
    partes.push(<span key={indice} data-casou className="font-semibold">{titulo.slice(inicio, fim)}</span>);
    cursor = fim;
  });
  partes.push(titulo.slice(cursor));
  return <>{partes}</>;
}

/**
 * A lista de notas que aparece ao digitar `[[`. O foco nunca sai do editor (o mouse não o tira da
 * caixa de texto: `mousedown` é cancelado); quem navega é o `aria-activedescendant` do campo.
 * Fica dentro do `<article>` (que é `relative`), então rola junto com o texto. Em tela estreita ocupa
 * a largura toda; a partir de `md` fica junto do cursor.
 */
export default function SugestoesDoEditor({ id, sugestoes, indiceAtivo, posicao, aoEscolher }: Props) {
  const lista = useRef<HTMLUListElement>(null);
  useEffect(() => {
    // Ajusta só a rolagem da lista: `scrollIntoView` rolaria também a página e podia tirar a linha do cursor da tela.
    const caixa = lista.current, item = caixa?.children[indiceAtivo] as HTMLElement | undefined;
    if (!caixa || !item) return;
    if (item.offsetTop < caixa.scrollTop) caixa.scrollTop = item.offsetTop;
    else if (item.offsetTop + item.offsetHeight > caixa.scrollTop + caixa.clientHeight) caixa.scrollTop = item.offsetTop + item.offsetHeight - caixa.clientHeight;
  }, [indiceAtivo]);
  const estilo = { top: posicao.topo, bottom: posicao.base, "--esquerda": `${posicao.esquerda}px` } as CSSProperties;
  return (
    // O `mousedown` cancelado em tudo (também na barra de rolagem) mantém o foco no campo; quem escolhe é o `click`.
    <ul ref={lista} id={id} role="listbox" aria-label="Notas para ligar" style={estilo} onMouseDown={(evento) => evento.preventDefault()}
      className="absolute inset-x-0 z-30 max-h-72 overflow-y-auto rounded-painel border border-borda bg-painel py-1 shadow-foco motion-safe:animate-entrada md:inset-x-auto md:left-(--esquerda) md:w-80">
      {sugestoes.map((sugestao, indice) => (
        <li key={sugestao.id} id={idDaOpcao(id, sugestao.id)} role="option" aria-selected={indice === indiceAtivo}
          aria-label={sugestao.pasta ? `${sugestao.titulo}, na pasta ${sugestao.pasta}` : sugestao.titulo}
          onClick={() => aoEscolher(indice)}
          className="flex min-h-10 cursor-pointer flex-col justify-center border-l-4 border-l-transparent px-3 py-1.5 text-controle text-texto aria-selected:border-l-destaque aria-selected:bg-destaque-suave aria-selected:text-destaque-texto">
          <span className="break-words"><TituloComDestaque titulo={sugestao.titulo} intervalos={sugestao.intervalos} /></span>
          {sugestao.pasta && <span className="break-words text-meta text-texto/75">{sugestao.pasta}</span>}
        </li>
      ))}
    </ul>
  );
}
