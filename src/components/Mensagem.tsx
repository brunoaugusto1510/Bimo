import { dividirCaminho } from "@/lib/caminho-da-nota";

export type AbrirNotaDoChat = (id: string, resumo?: { titulo: string; pasta: string | null }) => void;

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import MarcaBimo from "./MarcaBimo";
import type { Mensagem as TipoMensagem, UsoDeFerramenta } from "@/lib/types";

/**
 * Uma bolha de mensagem.
 *
 * O texto do usuário é mostrado como texto puro. O do agente passa pelo
 * ReactMarkdown, porque modelos respondem em Markdown (listas, negrito,
 * blocos de código) — sem isso a resposta apareceria cheia de `**` e `-`.
 */
export default function Mensagem({ mensagem, aoAbrirNota }: { mensagem: TipoMensagem; aoAbrirNota?: AbrirNotaDoChat }) {
  const doUsuario = mensagem.papel === "usuario";

  return (
    <div className={`flex ${doUsuario ? "justify-end" : "justify-start"}`}>
      <div className="max-w-[85%] space-y-1 motion-safe:animate-entrada">
        {/* O design não rotula a bolha do usuário — o lado da tela já diz quem
            falou. Para leitor de tela, o rótulo continua existindo. */}
        <span className="sr-only">{doUsuario ? "Você" : "Bimo"}</span>

        <div
          className={
            doUsuario
              ? "rounded-bolha rounded-br-sm bg-bolha-usuario px-4 py-3 text-bolha-usuario-texto"
              : "rounded-bolha rounded-bl-sm border border-borda bg-bolha-agente px-4 py-3"
          }
        >
          {doUsuario ? (
            // `whitespace-pre-wrap` preserva as quebras de linha que a pessoa digitou.
            <p className="text-sm leading-normal whitespace-pre-wrap text-pretty">
              {mensagem.conteudo}
            </p>
          ) : (
            <div className="text-sm leading-normal [&_a]:text-destaque-texto [&_a]:underline [&_code]:rounded [&_code]:bg-painel-alt [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em] [&_li]:my-0.5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_strong]:font-semibold [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {mensagem.conteudo}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {!doUsuario && <AssinaturaDoBimo />}

        {!doUsuario && mensagem.ferramentas && mensagem.ferramentas.length > 0 && (
          <UsosDeFerramentas usos={mensagem.ferramentas} aoAbrirNota={aoAbrirNota} />
        )}
      </div>
    </div>
  );
}

/**
 * A linha embaixo da bolha do agente: marca do cérebro + "Bimo AI", como no
 * ChatBubble do design system. Exportada porque a bolha de "pensando" do Chat
 * usa a mesma linha.
 */
export function AssinaturaDoBimo() {
  return (
    <span aria-hidden className="flex items-center gap-1 px-1 text-secao text-suave">
      <MarcaBimo />
      Bimo AI
    </span>
  );
}

/** Uma "pastilha" por ferramenta usada no turno — o que o agente consultou ou escreveu. */
function UsosDeFerramentas({ usos, aoAbrirNota }: { usos: UsoDeFerramenta[]; aoAbrirNota?: AbrirNotaDoChat }) {
  return (
    <div className="flex flex-wrap gap-1.5 px-1">
      {usos.map((uso, indice) => (
        <FerramentaUsada key={indice} uso={uso} aoAbrirNota={aoAbrirNota} />
      ))}
    </div>
  );
}

function FerramentaUsada({ uso, aoAbrirNota }: { uso: UsoDeFerramenta; aoAbrirNota?: AbrirNotaDoChat }) {
  // Mesmas cores do banner de erro do Chat, só que numa pastilha pequena —
  // erro de ferramenta é sempre não-fatal (o agente costuma se recuperar),
  // mas ainda vale destacar visualmente que algo não saiu como esperado.
  const classes = uso.erro
    ? "border-erro/30 bg-erro-suave text-erro"
    : "border-borda bg-painel-alt text-suave";

  // Escritas (criar_nota/editar_nota bem-sucedidas) viram link pro commit —
  // é a única ação aqui que gera uma mudança real e permanente no vault.
  // Por isso ganham o roxo suave das "sugestões do Bimo" em vez do cinza.
  if (uso.notaId && !uso.erro && aoAbrirNota) {
    const caminho = uso.argumentos.caminho;
    const resumo = typeof caminho === "string" && caminho.trim() ? dividirCaminho(caminho) : undefined;
    return <span className="inline-flex items-center gap-1">
      <button type="button" aria-label={`${uso.resumo}. Abrir nota`} onClick={() => aoAbrirNota(uso.notaId!, resumo)}
        className="min-h-10 rounded-full border border-destaque-suave-borda bg-destaque-suave px-3 text-meta text-destaque-texto transition-[background-color,transform] hover:bg-painel-alt motion-safe:active:scale-[0.96]">{uso.resumo}</button>
      {uso.commitUrl && <a href={uso.commitUrl} target="_blank" rel="noopener noreferrer" aria-label={`Abrir commit de «${resumo?.titulo ?? uso.resumo}» (nova aba)`} className="inline-flex h-10 min-w-10 items-center justify-center rounded-full text-destaque-texto"><span aria-hidden="true">↗</span></a>}
    </span>;
  }

  if (uso.commitUrl) {
    const corDoLink = uso.erro
      ? classes
      : "border-destaque-suave-borda bg-destaque-suave text-destaque-texto";
    return (
      <a
        href={uso.commitUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`rounded-full border px-2 py-0.5 text-xs font-medium hover:underline ${corDoLink}`}
      >
        {uso.resumo} ↗
      </a>
    );
  }

  return (
    <span className={`rounded-full border px-2 py-0.5 text-xs ${classes}`}>{uso.resumo}</span>
  );
}
