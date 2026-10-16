"use client";

import { useCallback, useMemo, useState, type Dispatch, type ReactNode } from "react";
import type { NotaParaArvore } from "@/lib/arvore-de-notas";
import { ABA_DO_GRAFICO, abaAtiva, idAtual, type Acao, type EstadoDoEspaco } from "@/lib/espaco-de-trabalho/estado";
import type { IdDeNota } from "@/lib/types";
import AbaDeNota from "./AbaDeNota";
import BarraDeAbas from "./BarraDeAbas";
import BarraDeStatus from "./BarraDeStatus";
import TelaInicial from "./TelaInicial";

type Props = {
  /** O modo Notas: só nele as abas e as notas aparecem; no modo Bimo isto só repassa o conteúdo. */
  ativo: boolean;
  estado: EstadoDoEspaco;
  despachar: Dispatch<Acao>;
  notas: ReadonlyMap<IdDeNota, NotaParaArvore>;
  /** Conexões de cada nota (o grau no grafo), para os cartões da tela inicial. */
  conexoesPorNota: ReadonlyMap<string, number>;
  totais: { notas: number; conexoes: number };
  aoAbrirNota: (id: IdDeNota, opcoes: { novaAba: boolean }) => void;
  aoCriarNota: (titulo: string) => void;
  aoPerguntarAoBimo: (id: IdDeNota | null) => void;
  aoIrParaNota: () => void;
  /** O grafo, o chat e o que mais mora por baixo das abas — a aba Gráfico é só deixá-lo à mostra. */
  children: ReactNode;
};

const formatar = (numero: number) => numero.toLocaleString("pt-BR");

/**
 * A moldura do modo Notas: a barra de abas, o conteúdo da aba ativa e a barra de status.
 *
 * O grafo (e o chat) ficam sempre montados em `children` — trocar de aba não pode
 * embaralhar o layout nem perder a conversa —, e uma aba de nota ou a tela inicial só
 * se põem por cima dele. Por isso a aba Gráfico não tem conteúdo próprio.
 */
export default function EspacoDeTrabalho({
  ativo,
  estado,
  despachar,
  notas,
  conexoesPorNota,
  totais,
  aoAbrirNota,
  aoCriarNota,
  aoPerguntarAoBimo,
  aoIrParaNota,
  children,
}: Props) {
  const aba = abaAtiva(estado);
  const [pendencias, definirPendencias] = useState<ReadonlyMap<string, boolean>>(new Map());
  const aoMudarPendencia = useCallback((id: string, pendente: boolean) => {
    definirPendencias((anteriores) => anteriores.get(id) === pendente ? anteriores : new Map(anteriores).set(id, pendente));
  }, []);

  const abas = useMemo(
    () =>
      estado.abas.map((candidata) => ({
        chave: candidata.chave,
        pendente: candidata.tipo === "nota" && pendencias.get(idAtual(candidata)),
        titulo: candidata.tipo === "nota" ? (notas.get(idAtual(candidata))?.titulo ?? "Nota") : "Nova aba",
      })),
    [estado.abas, notas, pendencias],
  );

  const recentes = useMemo(
    () =>
      estado.recentes.flatMap((id) => {
        const nota = notas.get(id);
        return nota ? [{ id, titulo: nota.titulo, pasta: nota.pasta, conexoes: conexoesPorNota.get(id) ?? 0 }] : [];
      }),
    [estado.recentes, notas, conexoesPorNota],
  );

  // Uma árvore só, nos dois modos. Se o modo Bimo devolvesse outra estrutura, o React veria
  // `children` em outro lugar, desmontaria e montaria de novo o chat e o grafo — e a conversa
  // e o layout da simulação se perderiam a cada ida e volta. Por isso tudo que é do modo
  // Notas entra com `{ativo && ...}`: o `false` ocupa o lugar e as posições não mudam.
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {ativo && (
        <BarraDeAbas
          abas={abas}
          ativa={estado.ativa}
          aoAtivar={(chave) => despachar({ tipo: "ativar-aba", chave })}
          aoFechar={(chave) => despachar({ tipo: "fechar-aba", chave })}
          aoNovaAba={() => despachar({ tipo: "nova-aba-vazia" })}
        />
      )}

      {/* O painel da aba ativa: o id e o rótulo seguem a aba, como o padrão de abas da WAI-ARIA pede. */}
      <div
        className="relative min-h-0 flex-1"
        {...(ativo ? { role: "tabpanel", id: `painel-${estado.ativa}`, "aria-labelledby": `aba-${estado.ativa}` } : {})}
      >
        {children}

        {estado.abas.map((candidata) => candidata.tipo === "nota" && (
          <div key={candidata.chave} hidden={!ativo || estado.ativa !== candidata.chave}>
          <AbaDeNota
            aba={candidata}
            ativa={ativo && estado.ativa === candidata.chave}
            aoMudarPendencia={aoMudarPendencia}
            notas={notas}
            aoVoltar={() => despachar({ tipo: "voltar" })}
            aoAvancar={() => despachar({ tipo: "avancar" })}
            aoAlternarModo={() => despachar({ tipo: "alternar-modo", chave: candidata.chave })}
            aoAbrirNota={aoAbrirNota}
            aoCriarNota={aoCriarNota}
            aoPerguntarAoBimo={aoPerguntarAoBimo}
          />
          </div>
        ))}

        {ativo && aba?.tipo === "vazia" && (
          <div className="absolute inset-0 z-10 overflow-auto bg-painel motion-safe:animate-entrada">
            <TelaInicial
              recentes={recentes}
              // Criar notas chega com a edição (Fase 8b).
              criarDisponivel={false}
              aoCriar={() => {}}
              aoIrParaNota={aoIrParaNota}
              aoAbrirGrafico={() => despachar({ tipo: "ativar-aba", chave: ABA_DO_GRAFICO })}
              aoPerguntarAoBimo={() => aoPerguntarAoBimo(null)}
              aoAbrirNota={(id) => aoAbrirNota(id, { novaAba: false })}
            />
          </div>
        )}
      </div>

      {/* A aba de nota tem a barra de status dela (palavras, caracteres); o gráfico e a tela inicial mostram os totais. */}
      {ativo && aba?.tipo !== "nota" && (
        <BarraDeStatus
          itens={[
            `${formatar(totais.notas)} ${totais.notas === 1 ? "nota" : "notas"}`,
            `${formatar(totais.conexoes)} ${totais.conexoes === 1 ? "conexão" : "conexões"}`,
          ]}
        />
      )}
    </div>
  );
}
