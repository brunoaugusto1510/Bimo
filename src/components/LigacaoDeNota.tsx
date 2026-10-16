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
  resolucao: ResolucaoDeLigacao;
  /** O repositório aceita escrita: só então uma ligação sem nota pode criá-la. */
  podeCriar: boolean;
  aoAbrir: (id: IdDeNota, opcoes: { novaAba: boolean }) => void;
  aoCriar: (titulo: string) => void;
  carregarPrevia: (id: IdDeNota) => Promise<PreviaDeNota | null>;
  children: ReactNode;
};

const tituloDoAlvo = (alvo: string) => alvo.split("/").pop() ?? alvo;

/**
 * Uma `[[ligação]]` dentro do texto de uma nota. Três jeitos de existir: link
 * (a nota existe), link com aviso (há mais de uma com o título) e botão
 * pendente (a nota ainda não existe — clicar a cria, se for permitido).
 */
export default function LigacaoDeNota({ alvo, resolucao, podeCriar, aoAbrir, aoCriar, carregarPrevia, children }: Props) {
  const idDaPrevia = useId();
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
      <button
        type="button"
        aria-disabled={!podeCriar}
        title={podeCriar ? `Criar a nota “${titulo}”` : "Criar notas não está disponível: as notas estão em modo somente leitura."}
        onClick={() => podeCriar && aoCriar(titulo)}
        className={`inline rounded-tag px-0.5 text-left underline decoration-dashed underline-offset-[3px] ${
          podeCriar ? "cursor-pointer text-suave hover:bg-painel-alt" : "cursor-not-allowed text-suave"
        }`}
      >
        {children}
      </button>
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
