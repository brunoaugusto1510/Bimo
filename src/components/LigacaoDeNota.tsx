"use client";

import { useEffect, useId, useRef, useState, type MouseEvent, type ReactNode } from "react";
import type { PreviaDeNota } from "@/lib/cliente-de-notas";
import type { ResolucaoDeLigacao } from "@/lib/ligacoes";
import { PREFIXO_DE_NOTA } from "@/lib/ligacoes-como-links";
import type { IdDeNota } from "@/lib/types";
import PreviaDeLigacao from "./PreviaDeLigacao";

/** Quanto o mouse (ou o foco) precisa ficar parado para a prévia abrir. */
const ATRASO_PARA_ABRIR_MS = 300;
/** Folga para o mouse atravessar o espaço entre o link e a prévia sem fechá-la. */
const ATRASO_PARA_FECHAR_MS = 150;

type Props = {
  /** O que a ligação diz — "Pasta/Título" ou só "Título". */
  alvo: string;
  pastaDeOrigem?: string | null;
  resolucao: ResolucaoDeLigacao;
  /** O repositório aceita escrita: só então uma ligação sem nota pode criá-la. */
  podeCriar: boolean;
  aoAbrir: (id: IdDeNota, opcoes: { novaAba: boolean }) => void;
  aoCriar: (alvo: string, pastaDeOrigem?: string | null, opcoes?: { novaAba: boolean }) => Promise<import("@/lib/espaco-de-trabalho/usar-criacao-de-nota").ResultadoDaAbertura | void> | void;
  carregarPrevia: (id: IdDeNota) => Promise<PreviaDeNota | null>;
  children: ReactNode;
};

const tituloDoAlvo = (alvo: string) => alvo.split("/").pop() ?? alvo;

/**
 * Uma `[[ligação]]` dentro do texto de uma nota. Três jeitos de existir: link
 * (a nota existe), link com aviso (há mais de uma com o título) e botão
 * pendente (a nota ainda não existe — clicar a cria, se for permitido).
 */
export default function LigacaoDeNota({ alvo, pastaDeOrigem = null, resolucao, podeCriar, aoAbrir, aoCriar, carregarPrevia, children }: Props) {
  const idDaPrevia = useId();
  const criandoRef = useRef(false);
  const [criando, definirCriando] = useState(false);
  const [erro, definirErro] = useState("");
  const [previa, setPrevia] = useState<PreviaDeNota | null>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Sobe a cada abertura ou fechamento: uma prévia que chega atrasada, de um pedido antigo, é descartada. */
  const pedidoAtual = useRef(0);

  const idDaNota = resolucao.tipo === "nao-resolvida" ? null : resolucao.nota.id;

  function parar() {
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = null;
  }

  function fechar() {
    parar();
    pedidoAtual.current++;
    setPrevia(null);
  }

  function agendarAbertura() {
    if (idDaNota === null) return;
    parar();
    if (previa) return;

    temporizador.current = setTimeout(() => {
      const pedido = ++pedidoAtual.current;
      carregarPrevia(idDaNota).then((carregada) => {
        if (pedido === pedidoAtual.current) setPrevia(carregada);
      });
    }, ATRASO_PARA_ABRIR_MS);
  }

  function agendarFecho() {
    parar();
    temporizador.current = setTimeout(fechar, ATRASO_PARA_FECHAR_MS);
  }

  // Sem isto, um temporizador pendente dispararia depois de a ligação sair da tela.
  useEffect(() => parar, []);

  if (resolucao.tipo === "nao-resolvida") {
    const titulo = tituloDoAlvo(alvo);
    return (
      <span><button
        type="button"
        aria-label={typeof children === "string" && children !== titulo ? `«${children}» (criar nota)` : `Criar a nota «${titulo}»`}
        aria-describedby={`${idDaPrevia}-motivo${erro ? ` ${idDaPrevia}-erro` : ""}`}
        aria-busy={criando}
        aria-disabled={!podeCriar || criando}
        title={podeCriar ? `Criar a nota “${titulo}”` : "Criar notas não está disponível: as notas estão em modo somente leitura."}
        onClick={async (evento) => {
          if (criandoRef.current) return;
          if (!podeCriar) { definirErro("Criar notas não está disponível no modo somente leitura."); return; }
          criandoRef.current = true; definirCriando(true); definirErro("");
          try {
            const resultado = await aoCriar(alvo, pastaDeOrigem, { novaAba: evento.ctrlKey || evento.metaKey });
            if (resultado?.tipo === "erro") definirErro(resultado.mensagem);
          } catch { definirErro("Falha ao criar nota."); }
          finally { criandoRef.current = false; definirCriando(false); }
        }}
        className="inline rounded-tag px-0.5 text-left text-texto underline decoration-dashed underline-offset-[3px] aria-disabled:cursor-not-allowed aria-disabled:opacity-50 [&:not([aria-disabled=true])]:cursor-pointer [&:not([aria-disabled=true])]:hover:bg-painel-alt"
      >
        {children}
      </button><span id={`${idDaPrevia}-motivo`} className="sr-only">{!podeCriar ? "Criar notas não está disponível no modo somente leitura." : criando ? "Criando nota…" : ""}</span><span id={`${idDaPrevia}-erro`} role="alert" className="ml-1 text-erro">{erro}</span></span>
    );
  }

  const { nota } = resolucao;
  const homonimas = resolucao.tipo === "ambigua" ? resolucao.candidatas.length : 0;

  function abrir(evento: MouseEvent<HTMLAnchorElement>) {
    evento.preventDefault();
    fechar();
    aoAbrir(nota.id, { novaAba: evento.ctrlKey || evento.metaKey });
  }

  return (
    <span
      className="relative"
      onMouseEnter={agendarAbertura}
      onMouseLeave={agendarFecho}
      onFocus={agendarAbertura}
      onBlur={agendarFecho}
      onKeyDown={(evento) => evento.key === "Escape" && fechar()}
    >
      <a
        data-ligacao
        href={`${PREFIXO_DE_NOTA}${encodeURIComponent(alvo)}`}
        onClick={abrir}
        onAuxClick={(evento) => {
          if (evento.button !== 1) return;
          evento.preventDefault();
          fechar();
          aoAbrir(nota.id, { novaAba: true });
        }}
        aria-describedby={previa ? idDaPrevia : undefined}
        title={homonimas > 1 ? `${homonimas} notas com este título — abrindo a de ${nota.pasta ?? "raiz"}` : undefined}
        className={`rounded-tag px-0.5 text-destaque-texto underline decoration-destaque-suave-borda underline-offset-[3px] transition-colors hover:bg-destaque-suave ${
          previa ? "bg-destaque-suave" : ""
        }`}
      >
        {children}
      </a>

      {previa && (
        <PreviaDeLigacao
          id={idDaPrevia}
          previa={previa}
          aoAbrir={({ novaAba }) => {
            fechar();
            aoAbrir(nota.id, { novaAba });
          }}
        />
      )}
    </span>
  );
}
