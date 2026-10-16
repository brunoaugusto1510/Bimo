"use client";

import { forwardRef, useMemo } from "react";
import type { Resolvedor } from "@/lib/ligacoes";
import { extrairTags } from "@/lib/markdown-da-nota";
import type { NotaCompleta } from "@/lib/repositorio-de-notas/tipos";
import type { IdDeNota } from "@/lib/types";
import PropriedadesDaNota from "./PropriedadesDaNota";
import RenderizadorDeMarkdown from "./RenderizadorDeMarkdown";

type Props = {
  nota: NotaCompleta;
  /** Quantas notas ligam a esta ou são ligadas por ela; `null` enquanto as ligações carregam. */
  conexoes: number | null;
  resolver: Resolvedor;
  podeCriar: boolean;
  aoAbrirNota: (id: IdDeNota, opcoes: { novaAba: boolean }) => void;
  aoCriarNota: (titulo: string) => void;
};

/**
 * A nota para ler: título, propriedades e o texto com as ligações clicáveis. A
 * referência vai ao `<article>` porque quem a contém precisa rolar até um título
 * (`[data-linha]`) quando a pessoa clica nele na "Estrutura" do painel lateral.
 */
const VisaoDaNota = forwardRef<HTMLElement, Props>(function VisaoDaNota(
  { nota, conexoes, resolver, podeCriar, aoAbrirNota, aoCriarNota },
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
      <h1 className="mb-4 text-titulo-nota font-semibold break-words text-balance text-destaque-texto">{nota.titulo}</h1>

      <div className="mb-7">
        <PropriedadesDaNota
          tags={tags}
          pasta={nota.pasta}
          criadoEm={nota.criadoEm}
          atualizadoEm={nota.atualizadoEm}
          conexoes={conexoes}
        />
      </div>

      <RenderizadorDeMarkdown
        conteudo={nota.conteudo}
        resolver={resolver}
        pastaDeOrigem={nota.pasta}
        podeCriar={podeCriar}
        aoAbrirNota={aoAbrirNota}
        aoCriarNota={aoCriarNota}
      />
    </article>
  );
});

export default VisaoDaNota;
