import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { dividirCaminho } from "@/lib/caminho-da-nota";
import type { IdDeNota, Mensagem as TipoMensagem, UsoDeFerramenta } from "@/lib/types";
import BimoPensando from "./BimoPensando";
import MarcaBimo from "./MarcaBimo";

export type AbrirNotaDoChat = (id: string, resumo?: { titulo: string; pasta: string | null }) => void;
/** Acende uma nota no cérebro por um instante — é o que um clique numa fonte faz. */
export type MostrarNoCerebro = (id: IdDeNota) => void;

/** O que a conversa mostra de cada passo do agente: a frase curta e se deu erro. */
export type PassoVisivel = Pick<UsoDeFerramenta, "resumo" | "erro">;

/** O canto da bolha que dá para quem fala é o menor (rounded-*-sm), como no design system. */
const BOLHA_DO_AGENTE = "rounded-bolha rounded-bl-sm border border-borda bg-bolha-agente px-4 py-3.5";
/** 32px de pílula, como no design; o `after` leva a área de toque a 40px. O recuo lateral vai em cada uso. */
const PILULA_COM_TOQUE = "relative h-8 max-w-full min-w-10 rounded-full text-meta font-semibold transition-[background-color,transform] after:absolute after:inset-x-0 after:-inset-y-1 after:content-[''] motion-safe:active:scale-[0.96]";

/**
 * Uma mensagem da conversa. A da pessoa é uma bolha azul à direita, com o texto puro. A do
 * Bimo vem à esquerda, com a marca dele: os passos que deu, a resposta (Markdown — modelos
 * respondem com listas, negrito e código) e, embaixo, as notas que leu e as que escreveu.
 */
export default function Mensagem({ mensagem, aoAbrirNota, aoMostrarNoCerebro }: {
  mensagem: TipoMensagem;
  aoAbrirNota?: AbrirNotaDoChat;
  aoMostrarNoCerebro?: MostrarNoCerebro;
}) {
  if (mensagem.papel === "usuario") {
    return (
      <div className="flex justify-end motion-safe:animate-entrada">
        {/* O lado da tela já diz quem falou; para leitor de tela, o rótulo continua existindo. */}
        <span className="sr-only">Você</span>
        {/* `whitespace-pre-wrap` preserva as quebras de linha que a pessoa digitou. */}
        <p className="max-w-[85%] rounded-bolha rounded-br-sm bg-bolha-usuario px-3.5 py-2.5 text-corpo whitespace-pre-wrap text-pretty text-bolha-usuario-texto md:max-w-[70%]">
          {mensagem.conteudo}
        </p>
      </div>
    );
  }

  return (
    // A vez já apareceu enquanto o Bimo pensava: só a bolha da resposta entra animada.
    <TurnoDoBimo passos={mensagem.ferramentas ?? []} animado={false}>
      <div className={`${BOLHA_DO_AGENTE} motion-safe:animate-entrada`}>
        <div className="text-corpo [&_a]:text-destaque-texto [&_a]:underline [&_code]:rounded [&_code]:bg-painel-alt [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em] [&_li]:my-0.5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_p]:text-pretty [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_strong]:font-semibold [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5">
          {/* Imagem vira só o texto alternativo: uma URL montada pelo modelo (que lê as notas) faria o navegador enviar dados para fora ao renderizar. */}
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ img: ({ alt }) => <span>{alt ? `[imagem: ${alt}]` : ""}</span> }}>
            {mensagem.conteudo}
          </ReactMarkdown>
        </div>
        <NotasDaResposta mensagem={mensagem} aoAbrirNota={aoAbrirNota} aoMostrarNoCerebro={aoMostrarNoCerebro} />
      </div>
    </TurnoDoBimo>
  );
}

/**
 * A vez do Bimo: a marca à esquerda e, ao lado, os passos que ele deu (as notas que buscou,
 * leu e escreveu) e o que vier depois — a resposta ou, enquanto ele trabalha, nada. Com
 * `pensando`, o último item é a pílula azul com o BimoPensando.
 */
export function TurnoDoBimo({ passos, pensando = false, animado = true, children }: {
  passos: readonly PassoVisivel[];
  pensando?: boolean;
  /** Falso quando a vez substitui a que estava pensando — senão marca e passos piscariam de novo. */
  animado?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className={`flex items-start gap-2.5 ${animado ? "motion-safe:animate-entrada" : ""}`}>
      <span className="mt-1.5 shrink-0">
        <MarcaBimo tamanho={20} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <span className="sr-only">Bimo</span>
        {(passos.length > 0 || pensando) && <PassosDoBimo passos={passos} pensando={pensando} />}
        {children}
      </div>
    </div>
  );
}

function PassosDoBimo({ passos, pensando }: { passos: readonly PassoVisivel[]; pensando: boolean }) {
  return (
    // `aria-live`: enquanto o Bimo trabalha, cada passo novo é anunciado quando chega.
    <ul aria-label="O que o Bimo fez" aria-live={pensando ? "polite" : undefined} className="flex flex-wrap gap-1.5">
      {passos.map((passo, indice) => (
        <li
          key={indice}
          className={`inline-flex min-h-8 max-w-full items-center gap-1.5 rounded-full border px-3 text-meta ${
            passo.erro ? "border-erro/30 bg-erro-suave text-erro" : "border-borda bg-painel text-texto"
          }`}
        >
          <span aria-hidden className={`size-1.5 shrink-0 rounded-full ${passo.erro ? "bg-erro" : "bg-destaque"}`} />
          <span className="truncate">{passo.resumo}</span>
        </li>
      ))}
      {pensando && (
        <li className="inline-flex min-h-8 items-center rounded-full border border-destaque-suave-borda bg-destaque-suave px-3">
          <BimoPensando compacto />
        </li>
      )}
    </ul>
  );
}

type NotaEscrita = { id: IdDeNota; titulo: string | null; caminho: string | null; pasta: string | null };

/** Uma linha por nota gravada (a última escrita de cada uma), na ordem em que aconteceram. */
function notasEscritas(ferramentas: readonly UsoDeFerramenta[]): NotaEscrita[] {
  const porId = new Map<IdDeNota, NotaEscrita>();
  for (const uso of ferramentas) {
    if (!uso.notaId || uso.erro) continue;
    const caminho = typeof uso.argumentos.caminho === "string" && uso.argumentos.caminho.trim() ? uso.argumentos.caminho : null;
    const partes = caminho ? dividirCaminho(caminho) : null;
    porId.set(uso.notaId, { id: uso.notaId, titulo: partes?.titulo ?? null, caminho, pasta: partes?.pasta ?? null });
  }
  return [...porId.values()];
}

/**
 * Embaixo da resposta: "Abrir" para cada nota que o Bimo criou ou editou (a única mudança
 * permanente da conversa, por isso o botão primário) e as "Fontes" — as notas que ele leu —,
 * que acendem a nota no cérebro em vez de abri-la.
 */
function NotasDaResposta({ mensagem, aoAbrirNota, aoMostrarNoCerebro }: {
  mensagem: TipoMensagem;
  aoAbrirNota?: AbrirNotaDoChat;
  aoMostrarNoCerebro?: MostrarNoCerebro;
}) {
  const escritas = aoAbrirNota ? notasEscritas(mensagem.ferramentas ?? []) : [];
  const escritasIds = new Set(escritas.map((nota) => nota.id));
  const fontes = aoMostrarNoCerebro ? (mensagem.fontes ?? []).filter((fonte) => !escritasIds.has(fonte.id)) : [];
  if (escritas.length === 0 && fontes.length === 0) return null;

  return (
    <div className="mt-3 flex flex-col gap-2.5">
      {escritas.map((nota) => (
        <div key={nota.id} className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <button
            type="button"
            onClick={() => aoAbrirNota?.(nota.id, nota.titulo === null ? undefined : { titulo: nota.titulo, pasta: nota.pasta })}
            className={`${PILULA_COM_TOQUE} bg-destaque px-3.5 text-sobre-destaque hover:bg-destaque-hover`}
          >
            {/* O corte fica no texto: no botão, o `overflow` recortaria a área de toque do `after`. */}
            <span className="block truncate">{nota.titulo ? `Abrir ${nota.titulo}` : "Abrir nota"}</span>
          </button>
          {nota.caminho && <span className="min-w-0 truncate text-meta text-suave">{nota.caminho}</span>}
        </div>
      ))}
      {fontes.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-secao font-semibold tracking-[0.08em] text-suave uppercase">Fontes</span>
          {fontes.map((fonte) => (
            <button
              key={fonte.id}
              type="button"
              aria-label={`${fonte.titulo}, mostrar no cérebro`}
              onClick={() => aoMostrarNoCerebro?.(fonte.id)}
              className={`${PILULA_COM_TOQUE} border border-destaque-suave-borda px-3 bg-destaque-suave text-destaque-texto hover:bg-painel-alt`}
            >
              <span className="block truncate">{fonte.titulo}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
