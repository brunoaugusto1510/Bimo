"use client";

import { forwardRef, useMemo, type ReactNode } from "react";
import type { Resolvedor } from "@/lib/ligacoes";
import { extrairTags } from "@/lib/markdown-da-nota";
import type { NotaCompleta } from "@/lib/repositorio-de-notas/tipos";
import type { IdDeNota } from "@/lib/types";
import PropriedadesDaNota, { type EdicaoDePropriedades } from "./PropriedadesDaNota";
import RenderizadorDeMarkdown from "./RenderizadorDeMarkdown";

type Props = {
  nota: NotaCompleta;
  /** Quantas notas ligam a esta ou são ligadas por ela; `null` enquanto as ligações carregam. */
  conexoes: number | null;
  resolver: Resolvedor;
  podeCriar: boolean;
  aoAbrirNota: (id: IdDeNota, opcoes: { novaAba: boolean }) => void;
  aoCriarNota: (alvo: string, pastaDeOrigem?: string | null, opcoes?: { novaAba: boolean }) => Promise<import("@/lib/espaco-de-trabalho/usar-criacao-de-nota").ResultadoDaAbertura> | void;
  children?: ReactNode;
  campoDeTitulo?: ReactNode;
  /** Em modo Edição, pasta e tags viram campos; as tags da coluna vêm da própria nota. */
  edicaoDePropriedades?: Omit<EdicaoDePropriedades, "tagsDaColuna">;
};

/**
 * A nota para ler: título, propriedades e o texto com as ligações clicáveis. A
 * referência vai ao `<article>` porque quem a contém precisa rolar até um título
 * (`[data-linha]`) quando a pessoa clica nele na "Estrutura" do painel lateral.
 */
const VisaoDaNota = forwardRef<HTMLElement, Props>(function VisaoDaNota(
  { nota, conexoes, resolver, podeCriar, aoAbrirNota, aoCriarNota, children, campoDeTitulo, edicaoDePropriedades },
  referencia,
) {
  // As tags valem de dois lugares: as da própria nota (coluna do banco) e as escritas no texto.
  const tags = useMemo(() => {
    const vistas = new Set<string>();
    return [...nota.tags, ...extrairTags(nota.conteudo)].filter((tag) => {
      const chave = tag.toLowerCase();
      if (vistas.has(chave)) return false;
      vistas.add(chave);
      return true;
    });
  }, [nota.tags, nota.conteudo]);

  return (
    <article ref={referencia} className="relative mx-auto max-w-[720px] px-5 pt-8 pb-24 md:px-8 md:pt-10">
      <h1 data-titulo-da-nota tabIndex={-1} className={campoDeTitulo ? "sr-only" : "mb-4 text-titulo-nota font-semibold break-words text-balance text-destaque-texto"}>{nota.titulo}</h1>
      {campoDeTitulo}

      <div className="mb-7">
        <PropriedadesDaNota
          edicao={edicaoDePropriedades && { ...edicaoDePropriedades, tagsDaColuna: nota.tags }}
          tags={tags}
          pasta={nota.pasta}
          criadoEm={nota.criadoEm}
          atualizadoEm={nota.atualizadoEm}
          conexoes={conexoes}
        />
      </div>

      {children ?? <RenderizadorDeMarkdown
        conteudo={nota.conteudo}
        resolver={resolver}
        pastaDeOrigem={nota.pasta}
        podeCriar={podeCriar}
        aoAbrirNota={aoAbrirNota}
        aoCriarNota={aoCriarNota}
      />}
    </article>
  );
});

export default VisaoDaNota;
