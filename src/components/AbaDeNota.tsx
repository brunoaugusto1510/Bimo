"use client";

import { useMemo, useRef, useState } from "react";
import { contarPalavras, extrairTitulos } from "@/lib/markdown-da-nota";
import { criarResolvedor } from "@/lib/ligacoes";
import { idAtual, type AbaDeNota as EstadoDaAbaDeNota } from "@/lib/espaco-de-trabalho/estado";
import { useLigacoes, useNota } from "@/lib/espaco-de-trabalho/usar-nota";
import type { NotaParaArvore } from "@/lib/arvore-de-notas";
import type { IdDeNota } from "@/lib/types";
import BarraDeNavegacao from "./BarraDeNavegacao";
import BarraDeStatus from "./BarraDeStatus";
import PainelLateralDaNota from "./PainelLateralDaNota";
import VisaoDaNota from "./VisaoDaNota";

type Props = {
  aba: EstadoDaAbaDeNota;
  /** Todas as notas, por id: dão o título e a pasta enquanto a nota ainda carrega. */
  notas: ReadonlyMap<IdDeNota, NotaParaArvore>;
  aoVoltar: () => void;
  aoAvancar: () => void;
  aoAlternarModo: () => void;
  aoAbrirNota: (id: IdDeNota, opcoes: { novaAba: boolean }) => void;
  aoCriarNota: (titulo: string) => void;
  aoPerguntarAoBimo: (id: IdDeNota) => void;
};

const formatar = (numero: number) => numero.toLocaleString("pt-BR");

/**
 * O que uma aba de nota mostra: a navegação (voltar, caminho, modo), a nota, o painel
 * lateral (ligações, estrutura, sugestão) e a barra de status. Carrega a nota e as
 * ligações dela por conta própria; a nota abre primeiro e o painel preenche depois.
 */
export default function AbaDeNota({
  aba,
  notas,
  aoVoltar,
  aoAvancar,
  aoAlternarModo,
  aoAbrirNota,
  aoCriarNota,
  aoPerguntarAoBimo,
}: Props) {
  const id = idAtual(aba);
  const nota = useNota(id);
  const ligacoes = useLigacoes(id);
  const artigo = useRef<HTMLElement>(null);
  // O que foi "descartado" na sugestão do Bimo vale só enquanto esta nota está nesta aba.
  const [sugestoesDescartadas, setSugestoesDescartadas] = useState<ReadonlySet<IdDeNota>>(new Set());

  const resolver = useMemo(() => criarResolvedor([...notas.values()]), [notas]);
  const resumo = notas.get(id);
  const titulo = nota.dados?.nota.titulo ?? resumo?.titulo ?? "Nota";
  const pasta = nota.dados?.nota.pasta ?? resumo?.pasta ?? null;

  const conteudo = nota.dados?.nota.conteudo ?? "";
  const estrutura = useMemo(() => extrairTitulos(conteudo), [conteudo]);
  const entradas = ligacoes.dados?.ligacoes.entrada ?? [];
  const saidas = ligacoes.dados?.ligacoes.saida ?? [];
  const sugestao = ligacoes.dados?.mencoesSemLigacao.find((mencao) => !sugestoesDescartadas.has(mencao.id)) ?? null;

  // Conexões são notas ligadas a esta, nos dois sentidos: quem a cita e é citada por ela conta uma vez só.
  const conexoes =
    ligacoes.estado === "pronto"
      ? new Set([...entradas.map((entrada) => entrada.id), ...saidas.flatMap((destino) => (destino.tipo === "nota" ? [destino.id] : []))]).size
      : null;
  const escrita = nota.dados?.capacidades.escrita ?? false;

  function irParaLinha(linha: number) {
    artigo.current?.querySelector(`[data-linha="${linha}"]`)?.scrollIntoView?.({ block: "start" });
  }

  return (
    <div className="absolute inset-0 z-10 flex flex-col bg-painel motion-safe:animate-entrada">
      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <BarraDeNavegacao
            pasta={pasta}
            titulo={titulo}
            podeVoltar={aba.historico.indice > 0}
            podeAvancar={aba.historico.indice < aba.historico.pilha.length - 1}
            modo={aba.modo}
            // A edição chega com o salvamento automático (Fase 8a); até lá, só leitura.
            edicaoDisponivel={false}
            aoVoltar={aoVoltar}
            aoAvancar={aoAvancar}
            aoAlternarModo={aoAlternarModo}
            aoCopiarLigacao={() => {
              // `[[Título]]` basta quando o título leva só a esta nota; com repetição, o caminho desfaz a dúvida.
              const unico = resolver(titulo, null);
              const alvo = unico.tipo === "resolvida" && unico.nota.id === id ? titulo : `${pasta ? `${pasta}/` : ""}${titulo}`;
              void navigator.clipboard?.writeText(`[[${alvo}]]`);
            }}
            aoAbrirEmNovaAba={() => aoAbrirNota(id, { novaAba: true })}
            aoPerguntarAoBimo={() => aoPerguntarAoBimo(id)}
          />

          <div className="min-h-0 flex-1 overflow-auto">
            {nota.estado === "carregando" && <p className="px-8 py-10 text-sm text-suave">Carregando…</p>}

            {nota.estado === "erro" && (
              <div className="mx-auto max-w-[720px] px-8 py-10">
                <p className="text-sm text-texto">
                  {nota.status === 404 ? "Esta nota não existe mais." : nota.status === 401 ? "Sua sessão expirou. Entre de novo." : nota.mensagem}
                </p>
                {nota.status === 401 ? (
                  <a
                    href="/login"
                    className="mt-3 inline-flex min-h-10 items-center rounded-full bg-destaque px-4 text-controle font-semibold text-sobre-destaque transition-[background-color,transform] hover:bg-destaque-hover motion-safe:active:scale-[0.96]"
                  >
                    Entrar de novo
                  </a>
                ) : nota.status !== 404 ? (
                  <button
                    type="button"
                    onClick={nota.recarregar}
                    className="mt-3 min-h-10 rounded-full border border-borda px-4 text-controle font-semibold text-texto transition-[background-color,transform] hover:bg-painel-alt motion-safe:active:scale-[0.96]"
                  >
                    Tentar de novo
                  </button>
                ) : null}
              </div>
            )}

            {nota.dados && (
              <VisaoDaNota
                ref={artigo}
                nota={nota.dados.nota}
                conexoes={conexoes}
                resolver={resolver}
                podeCriar={false}
                aoAbrirNota={aoAbrirNota}
                aoCriarNota={aoCriarNota}
              />
            )}
          </div>
        </div>

        <div className="hidden w-72 shrink-0 lg:flex xl:w-80">
          <PainelLateralDaNota
            estado={ligacoes.estado}
            sugestao={sugestao ? { id: sugestao.id, titulo: sugestao.titulo } : null}
            entradas={entradas}
            saidas={saidas}
            estrutura={estrutura}
            // Inserir a ligação no texto precisa da edição (Fase 8a).
            podeInserir={false}
            aoAbrirNota={(destino) => aoAbrirNota(destino, { novaAba: false })}
            aoIrParaLinha={irParaLinha}
            aoInserirSugestao={() => {}}
            aoDescartarSugestao={() => sugestao && setSugestoesDescartadas((antes) => new Set(antes).add(sugestao.id))}
            aoPerguntarAoBimo={() => aoPerguntarAoBimo(id)}
          />
        </div>
      </div>

      <BarraDeStatus
        itens={[
          ...(conexoes === null ? [] : [`${formatar(conexoes)} ${conexoes === 1 ? "conexão" : "conexões"}`]),
          ...(nota.dados
            ? [`${formatar(contarPalavras(conteudo))} palavras`, `${formatar(conteudo.length)} caracteres`]
            : []),
        ]}
        mensagem={escrita ? undefined : "Somente leitura"}
      />
    </div>
  );
}
