"use client";
import { useState } from "react";
import type { PaginaDoDiario, ResumoDoCerebro } from "@/lib/wiki/cliente";
import { useConsultaWiki } from "./usar-consulta-wiki";
import { botaoSecundario, cartao } from "./estilos";
import { useFocoDoPainel } from "./usar-foco-do-painel";
import CerebroDaWiki, { type NeuronioSelecionado } from "./CerebroDaWiki";
import DiarioDaWiki from "./DiarioDaWiki";
import type { FiltroDoCerebro } from "./filtro-do-cerebro";

type Props = {
  tela: "cerebro" | "diario";
  aoFechar: () => void;
  aoAbrirNeuronio: (id: string) => void;
  aoVerCerebro: () => void;
  filtro?: FiltroDoCerebro;
  aoFiltrar?: (filtro: FiltroDoCerebro) => void;
  selecionado?: NeuronioSelecionado | null;
  aoVerOrigens?: () => void;
  aoPerguntar?: (id: string) => void;
  aoDesselecionar?: () => void;
  aoAbrirNota?: (id: string) => void;
};

/** Busca os dados do cérebro e do diário e mostra a tela pedida por cima do grafo. */
export default function PainelDaWiki({ tela, aoFechar, aoAbrirNeuronio, aoVerCerebro, filtro = "tudo", aoFiltrar, selecionado = null, aoVerOrigens, aoPerguntar, aoDesselecionar, aoAbrirNota }: Props) {
  const foco = useFocoDoPainel(tela);
  const [tentativa, tentar] = useState(0);
  const cerebro = useConsultaWiki<ResumoDoCerebro>("/api/wiki/cerebro", tentativa);
  // O cursor pertence à tela em que foi aberto: ao voltar ao Diário o painel começa pela primeira página.
  const [paginacao, ir] = useState<{ tela: string; cursor: { criadoEm: string; id: string } | null }>({ tela, cursor: null });
  // Trocar de tela descarta o cursor (estado derivado, ajustado durante a renderização).
  if (paginacao.tela !== tela) ir({ tela, cursor: null });
  const cursor = paginacao.tela === tela ? paginacao.cursor : null;
  // Sem `inicio` e `fim` o servidor usa os últimos sete dias até agora, e cada consulta (inclusive a de 30 s) enxerga os eventos novos.
  const consulta = new URLSearchParams({ limite: "30", ...(cursor ? { antesEm: cursor.criadoEm, antesId: cursor.id } : {}) });
  const diarioAtual = useConsultaWiki<PaginaDoDiario>(tela === "diario" ? `/api/wiki/diario?${consulta}` : null, tentativa);
  // Ao paginar, a página anterior fica na tela até a nova chegar: o botão clicado não some e o foco não cai no <body>.
  const [ultimaPagina, guardarPagina] = useState<PaginaDoDiario | undefined>(undefined);
  if (diarioAtual?.dados && diarioAtual.dados !== ultimaPagina) guardarPagina(diarioAtual.dados);
  const diario = diarioAtual ?? (tela === "diario" && ultimaPagina ? { url: "", dados: ultimaPagina } : null);
  const atual = tela === "diario" ? diario : cerebro;
  // Com dados anteriores a falha passageira não apaga a tela, mas a sessão expirada sempre aparece (com o link para entrar).
  const semDados = !atual?.dados || atual.status === 401;
  const diarioAberto = tela === "diario";

  let conteudo;
  if (!atual) conteudo = <p role="status" className={`pointer-events-auto m-3 self-start px-4 py-3 text-controle md:m-5 ${cartao}`}>Carregando…</p>;
  else if (atual.erro && semDados) conteudo = (
    <div className={`pointer-events-auto m-3 flex flex-col items-start gap-3 self-start p-5 md:m-5 ${cartao}`}>
      <p role="alert" className="text-controle">{atual.erro}</p>
      <div className="flex gap-2">
        {atual.status === 401 ? <a className={botaoSecundario} href="/login">Entrar novamente</a> : <button type="button" className={botaoSecundario} onClick={() => tentar((n) => n + 1)}>Tentar de novo</button>}
        <button type="button" aria-label={diarioAberto ? "Fechar diário" : "Fechar cérebro"} className={botaoSecundario} onClick={aoFechar}>Fechar</button>
      </div>
    </div>
  );
  else if (diarioAberto) conteudo = <DiarioDaWiki eventos={diario?.dados?.eventos ?? []} proximo={diario?.dados?.proximo ?? null} paginado={Boolean(cursor)} aoPaginar={(c) => ir({ tela, cursor: c })}
    cerebro={cerebro?.dados} erroDoCerebro={cerebro?.erro} aoVerCerebro={aoVerCerebro} aoFechar={aoFechar} aoAbrirNeuronio={aoAbrirNeuronio} aoAbrirNota={aoAbrirNota} />;
  else conteudo = <CerebroDaWiki dados={cerebro!.dados!} filtro={filtro} aoFiltrar={(f) => aoFiltrar?.(f)} selecionado={selecionado} aoFechar={aoFechar}
    aoAbrirNeuronio={aoAbrirNeuronio} aoVerOrigens={aoVerOrigens} aoPerguntar={aoPerguntar} aoDesselecionar={aoDesselecionar} />;

  return (
    <section ref={foco} tabIndex={-1} aria-label={diarioAberto ? "Enquanto você estava fora" : "Cérebro"}
      className={`absolute inset-0 z-20 flex flex-col outline-none ${diarioAberto ? "overflow-y-auto bg-fundo" : "pointer-events-none overflow-hidden"}`}>
      {conteudo}
    </section>
  );
}
