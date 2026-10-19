"use client";

import { createContext, createElement, useContext, useMemo, type ComponentPropsWithoutRef, type ReactNode } from "react";
import ReactMarkdown, { type Components, type ExtraProps } from "react-markdown";
import remarkGfm from "remark-gfm";
import { buscarPrevia, type PreviaDeNota } from "@/lib/cliente-de-notas";
import { PREFIXO_DE_ANEXO, PREFIXO_DE_NOTA, ligacoesComoLinks } from "@/lib/ligacoes-como-links";
import type { Resolvedor } from "@/lib/ligacoes";
import { separarFrontmatter } from "@/lib/markdown-da-nota";
import type { IdDeNota } from "@/lib/types";
import LigacaoDeNota from "./LigacaoDeNota";

type Props = {
  /** O texto inteiro da nota, com o frontmatter: ele é tirado aqui, e os títulos guardam a linha que têm no texto inteiro. */
  conteudo: string;
  resolver: Resolvedor;
  /** A pasta da nota que está sendo lida — um título repetido se resolve pela pasta mais próxima dela. */
  pastaDeOrigem: string | null;
  podeCriar: boolean;
  aoAbrirNota: (id: IdDeNota, opcoes: { novaAba: boolean }) => void;
  aoCriarNota: (alvo: string, pastaDeOrigem?: string | null, opcoes?: { novaAba: boolean }) => Promise<import("@/lib/espaco-de-trabalho/usar-criacao-de-nota").ResultadoDaAbertura> | void;
  carregarPrevia?: (id: IdDeNota) => Promise<PreviaDeNota | null>;
};

type DadosDasLigacoes = Required<Omit<Props, "conteudo">>;

/**
 * O que as ligações precisam e muda a cada render do pai (o resolvedor, os callbacks). Vai por
 * contexto, e não dentro de `components`, de propósito: o react-markdown trata `components.a` e
 * `h1..h6` como tipos de componente, então um `components` novo desmontaria todos os links e
 * títulos a cada render — descartando a prévia aberta, a seleção de texto e o foco. Com o
 * contexto, `components` fica estável e só o conteúdo dos links é redesenhado.
 */
const ContextoDasLigacoes = createContext<DadosDasLigacoes | null>(null);

type PropsDe<T extends keyof React.JSX.IntrinsicElements> = ComponentPropsWithoutRef<T> & ExtraProps;

/** Um link escrito à mão pode ter porcentagem inválida; isso não pode derrubar a página. */
function decodificar(texto: string): string {
  try {
    return decodeURIComponent(texto);
  } catch {
    return texto;
  }
}

function LinkDoMarkdown({ href = "", children }: PropsDe<"a">): ReactNode {
  const dados = useContext(ContextoDasLigacoes);

  if (dados && href.startsWith(PREFIXO_DE_NOTA)) {
    const alvo = decodificar(href.slice(PREFIXO_DE_NOTA.length).split("#")[0]);
    return (
      <LigacaoDeNota
        alvo={alvo}
        pastaDeOrigem={dados.pastaDeOrigem}
        resolucao={dados.resolver(alvo, dados.pastaDeOrigem)}
        podeCriar={dados.podeCriar}
        aoAbrir={dados.aoAbrirNota}
        aoCriar={dados.aoCriarNota}
        carregarPrevia={dados.carregarPrevia}
      >
        {children}
      </LigacaoDeNota>
    );
  }

  if (href.startsWith(PREFIXO_DE_ANEXO)) {
    return (
      <span className="rounded-tag bg-painel-alt px-1 text-suave" title="Os anexos ainda não aparecem aqui.">
        {children} <span className="text-meta">(anexo não disponível)</span>
      </span>
    );
  }

  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}

const NIVEIS = [1, 2, 3, 4, 5, 6] as const;

/** Os títulos de cada nível, marcados com a linha deles no texto inteiro (é por ela que a "Estrutura" rola até eles). */
function criarCabecalhos(linhasDoFrontmatter: number): Components {
  return Object.fromEntries(
    NIVEIS.map((nivel) => [
      `h${nivel}`,
      ({ node, children }: PropsDe<"h1">) =>
        createElement(`h${nivel}`, { "data-linha": (node?.position?.start.line ?? 1) + linhasDoFrontmatter }, children),
    ]),
  );
}

/**
 * O texto de uma nota como o leitor o vê: Markdown comum, com `[[ligações]]`
 * clicáveis. Não aceita HTML cru (o `react-markdown` não o interpreta) e links
 * para fora abrem em outra aba, sem dar à página aberta o controle da nossa.
 */
export default function RenderizadorDeMarkdown({
  conteudo,
  resolver,
  pastaDeOrigem,
  podeCriar,
  aoAbrirNota,
  aoCriarNota,
  carregarPrevia = buscarPrevia,
}: Props) {
  const { corpo, linhasDoFrontmatter } = useMemo(() => {
    const separado = separarFrontmatter(conteudo);
    return {
      corpo: ligacoesComoLinks(separado.corpo),
      linhasDoFrontmatter: conteudo.slice(0, separado.inicioDoCorpo).split("\n").length - 1,
    };
  }, [conteudo]);

  const componentes = useMemo<Components>(
    () => ({ ...criarCabecalhos(linhasDoFrontmatter), a: LinkDoMarkdown }),
    [linhasDoFrontmatter],
  );

  const dados = { resolver, pastaDeOrigem, podeCriar, aoAbrirNota, aoCriarNota, carregarPrevia };

  return (
    <ContextoDasLigacoes.Provider value={dados}>
      <div className="text-corpo break-words [&_a:not([data-ligacao])]:text-destaque-texto [&_a:not([data-ligacao])]:underline [&_blockquote]:my-3 [&_blockquote]:rounded-painel [&_blockquote]:bg-painel-alt [&_blockquote]:px-4 [&_blockquote]:py-3.5 [&_blockquote]:italic [&_code]:rounded-tag [&_code]:bg-painel-alt [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em] [&_h1]:mt-7 [&_h1]:mb-2 [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:mt-7 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mt-5 [&_h3]:mb-1.5 [&_h3]:font-semibold [&_input[type=checkbox]]:mr-2.5 [&_input[type=checkbox]]:accent-destaque [&_li]:my-0.5 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-5.5 [&_p]:my-3 [&_p:first-child]:mt-0 [&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-painel [&_pre]:bg-painel-alt [&_pre]:p-3.5 [&_strong]:font-semibold [&_table]:my-3 [&_td]:border [&_td]:border-borda [&_td]:px-2.5 [&_td]:py-1.5 [&_th]:border [&_th]:border-borda [&_th]:px-2.5 [&_th]:py-1.5 [&_ul]:my-3 [&_ul]:pl-5.5 [&_ul:not(.contains-task-list)]:list-disc [&_.contains-task-list]:list-none [&_.contains-task-list]:pl-0">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={componentes}>
          {corpo}
        </ReactMarkdown>
      </div>
    </ContextoDasLigacoes.Provider>
  );
}
