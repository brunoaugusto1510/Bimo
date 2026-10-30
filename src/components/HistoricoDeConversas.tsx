"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { ClienteDeConversas } from "@/lib/conversas/cliente";
import type { IdDeConversa, ResumoDeConversa } from "@/lib/conversas/tipos";

type Props = {
  cliente: ClienteDeConversas;
  /** Chamado antes de buscar a lista: o chat espera aqui as gravações em andamento. */
  antesDeListar?: () => Promise<void>;
  /** A conversa que está na tela, para marcá-la na lista. */
  idAtual: IdDeConversa;
  /** Falso quando a conversa na tela ainda não tem mensagens: não há o que recomeçar. */
  temMensagens: boolean;
  /** O agente está respondendo (ou uma conversa está abrindo): trocar de conversa agora perderia a resposta. */
  ocupado: boolean;
  aoNovaConversa: () => void;
  aoEscolher: (id: IdDeConversa) => void;
  /** A conversa já foi apagada no servidor. */
  aoExcluida: (id: IdDeConversa) => void;
};

const botaoDaBarra =
  "inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-full border border-borda bg-painel px-3.5 text-controle text-texto transition-[background-color,color,transform] hover:bg-painel-alt focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-destaque disabled:opacity-50 motion-safe:enabled:active:scale-[0.96]";
const botaoDeLinha =
  "inline-flex min-h-10 shrink-0 items-center justify-center rounded-full px-3 text-controle transition-[background-color,color,transform] focus-visible:outline-2 focus-visible:outline-destaque motion-safe:active:scale-[0.96]";

const formatoDaData = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

function dataDaConversa(iso: string): string {
  const data = new Date(iso);
  return Number.isNaN(data.getTime()) ? "" : formatoDaData.format(data);
}

type Estado =
  | { tipo: "carregando" }
  | { tipo: "erro"; mensagem: string }
  | { tipo: "pronto"; conversas: ResumoDeConversa[] };

/** Os dois botões do alto do chat — "Histórico" e "Novo chat" — e a lista que o primeiro abre. */
export default function HistoricoDeConversas({ cliente, antesDeListar, idAtual, temMensagens, ocupado, aoNovaConversa, aoEscolher, aoExcluida }: Props) {
  const [aberto, setAberto] = useState(false);
  const [estado, setEstado] = useState<Estado>({ tipo: "carregando" });
  const [confirmando, setConfirmando] = useState<IdDeConversa | null>(null);
  const [erroDaExclusao, setErroDaExclusao] = useState<string | null>(null);
  const botaoDoHistorico = useRef<HTMLButtonElement>(null);
  const idDoPainel = useId();

  // A lista é buscada a cada vez que abre: a conversa atual pode ter ganhado mensagens desde a última.
  useEffect(() => {
    if (!aberto) return;
    let cancelado = false;
    (async () => {
      await antesDeListar?.();
      return cliente.listar();
    })().then(
      (conversas) => { if (!cancelado) setEstado({ tipo: "pronto", conversas }); },
      (falha) => { if (!cancelado) setEstado({ tipo: "erro", mensagem: falha instanceof Error ? falha.message : "Não consegui carregar o histórico." }); },
    );
    return () => { cancelado = true; };
    // `antesDeListar` muda a cada render do chat; refazer a busca por isso piscaria a lista.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, cliente]);

  useEffect(() => {
    if (!aberto) return;
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key !== "Escape") return;
      setAberto(false);
      botaoDoHistorico.current?.focus();
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [aberto]);

  function alternar() {
    setConfirmando(null);
    setErroDaExclusao(null);
    if (!aberto) setEstado({ tipo: "carregando" });
    setAberto((estava) => !estava);
  }

  function escolher(id: IdDeConversa) {
    setAberto(false);
    aoEscolher(id);
  }

  async function excluir(id: IdDeConversa) {
    setErroDaExclusao(null);
    try {
      await cliente.excluir(id);
    } catch (falha) {
      setErroDaExclusao(falha instanceof Error ? falha.message : "Não consegui apagar a conversa.");
      return;
    }
    setConfirmando(null);
    setEstado((atual) => (atual.tipo === "pronto" ? { tipo: "pronto", conversas: atual.conversas.filter((c) => c.id !== id) } : atual));
    aoExcluida(id);
  }

  return (
    <div className="relative shrink-0 px-3 pt-3 md:px-4">
      <div className="mx-auto flex max-w-2xl items-center justify-end gap-2">
        <button
          ref={botaoDoHistorico}
          type="button"
          onClick={alternar}
          aria-expanded={aberto}
          aria-controls={idDoPainel}
          className={botaoDaBarra}
        >
          <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </svg>
          Histórico
        </button>
        <button
          type="button"
          onClick={() => { setAberto(false); aoNovaConversa(); }}
          disabled={!temMensagens || ocupado}
          className={botaoDaBarra}
        >
          <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="size-4">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Novo chat
        </button>
      </div>

      {aberto && (
        <section
          id={idDoPainel}
          aria-label="Histórico de conversas"
          className="absolute inset-x-3 top-14 z-20 mx-auto max-h-[min(24rem,70vh)] max-w-2xl overflow-y-auto rounded-painel border border-borda bg-painel p-2 motion-safe:animate-entrada md:inset-x-4"
        >
          {estado.tipo === "carregando" && <p role="status" className="px-3 py-4 text-controle text-suave">Carregando…</p>}
          {estado.tipo === "erro" && <p role="alert" className="rounded-lg bg-erro-suave px-3 py-2 text-controle text-erro">{estado.mensagem}</p>}
          {estado.tipo === "pronto" && estado.conversas.length === 0 && (
            <p className="px-3 py-4 text-controle text-pretty text-suave">Nenhuma conversa guardada ainda. As próximas aparecem aqui.</p>
          )}
          {erroDaExclusao && <p role="alert" className="mb-1 rounded-lg bg-erro-suave px-3 py-2 text-controle text-erro">{erroDaExclusao}</p>}
          {estado.tipo === "pronto" && estado.conversas.length > 0 && (
            <ul className="flex flex-col gap-0.5">
              {estado.conversas.map((conversa) => (
                <li key={conversa.id} className="flex items-center gap-1">
                  {confirmando === conversa.id ? (
                    <>
                      <p className="min-w-0 flex-1 truncate px-3 text-controle text-texto">Apagar “{conversa.titulo}”?</p>
                      <button type="button" onClick={() => excluir(conversa.id)} className={`${botaoDeLinha} bg-erro-suave font-semibold text-erro`}>Apagar</button>
                      <button type="button" onClick={() => setConfirmando(null)} className={`${botaoDeLinha} text-suave hover:bg-painel-alt hover:text-texto`}>Cancelar</button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => escolher(conversa.id)}
                        disabled={ocupado}
                        aria-current={conversa.id === idAtual ? "true" : undefined}
                        className="flex min-h-10 min-w-0 flex-1 flex-col items-start rounded-lg px-3 py-1.5 text-left transition-[background-color] hover:bg-painel-alt focus-visible:outline-2 focus-visible:outline-destaque disabled:opacity-50 aria-[current=true]:bg-destaque-suave"
                      >
                        <span className="w-full truncate text-controle text-texto">{conversa.titulo}</span>
                        <span className="text-meta text-suave tabular-nums">{dataDaConversa(conversa.atualizadaEm)}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => { setErroDaExclusao(null); setConfirmando(conversa.id); }}
                        aria-label={`Apagar a conversa “${conversa.titulo}”`}
                        className="inline-flex size-10 shrink-0 items-center justify-center rounded-full text-suave transition-[background-color,color,transform] hover:bg-painel-alt hover:text-texto focus-visible:outline-2 focus-visible:outline-destaque motion-safe:active:scale-[0.96]"
                      >
                        <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4">
                          <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
                        </svg>
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
