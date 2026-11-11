"use client";

import { forwardRef, useMemo, type ReactNode } from "react";
import type { Resolvedor } from "@/lib/ligacoes";
import { extrairTags } from "@/lib/markdown-da-nota";
import type { NotaCompleta } from "@/lib/repositorio-de-notas/tipos";
import type { IdDeNota } from "@/lib/types";
import PropriedadesDaNota, { type EdicaoDePropriedades } from "./PropriedadesDaNota";
import RenderizadorDeMarkdown from "./RenderizadorDeMarkdown";
import Dialogo from "./Dialogo";

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
  propriedadesAbertas?: boolean;
  aoFecharPropriedades?: () => void;
  /** Em modo Edição, pasta e tags viram campos; as tags da coluna vêm da própria nota. */
  edicaoDePropriedades?: Omit<EdicaoDePropriedades, "tagsDaColuna">;
};

/**
 * A nota para ler: título, propriedades e o texto com as ligações clicáveis. A
 * referência vai ao `<article>` porque quem a contém precisa rolar até um título
 * (`[data-linha]`) quando a pessoa clica nele na "Estrutura" do painel lateral.
 */
const VisaoDaNota = forwardRef<HTMLElement, Props>(function VisaoDaNota(
  { nota, conexoes, resolver, podeCriar, aoAbrirNota, aoCriarNota, children, campoDeTitulo, edicaoDePropriedades, propriedadesAbertas = false, aoFecharPropriedades },
  referencia,
) {
  const mostrarPropriedades = !campoDeTitulo || propriedadesAbertas;
  // Evita varrer o texto a cada tecla quando as propriedades estão fechadas.
  const tags = useMemo(() => {
    if (!mostrarPropriedades) return [];
    const vistas = new Set<string>();
    return [...nota.tags, ...extrairTags(nota.conteudo)].filter((tag) => {
      const chave = tag.toLowerCase();
      if (vistas.has(chave)) return false;
      vistas.add(chave);
      return true;
    });
  }, [nota.tags, nota.conteudo, mostrarPropriedades]);

  const propriedades = <PropriedadesDaNota
    edicao={edicaoDePropriedades && { ...edicaoDePropriedades, tagsDaColuna: nota.tags }}
    tags={tags} pasta={nota.pasta} criadoEm={nota.criadoEm}
    atualizadoEm={nota.atualizadoEm} conexoes={conexoes}
  />;

  return (
    <article ref={referencia} className={`relative mx-auto px-5 pb-24 md:px-8 ${campoDeTitulo ? "max-w-[744px] pt-10 md:pt-16" : "max-w-[720px] pt-8 md:pt-10"}`}>
      <h1 data-titulo-da-nota tabIndex={-1} className={campoDeTitulo ? "sr-only" : "mb-4 text-titulo-nota font-semibold break-words text-balance text-destaque-texto"}>{nota.titulo}</h1>
      {campoDeTitulo}

      {campoDeTitulo
        ? propriedadesAbertas && aoFecharPropriedades && <Dialogo titulo="Propriedades da nota" aoFechar={aoFecharPropriedades} ocupado={edicaoDePropriedades?.ocupado}>{propriedades}</Dialogo>
        : <div className="mb-7">{propriedades}</div>}

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
