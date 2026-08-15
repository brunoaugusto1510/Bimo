import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Mensagem as TipoMensagem } from "@/lib/types";

/**
 * Uma bolha de mensagem.
 *
 * O texto do usuário é mostrado como texto puro. O do agente passa pelo
 * ReactMarkdown, porque modelos respondem em Markdown (listas, negrito,
 * blocos de código) — sem isso a resposta apareceria cheia de `**` e `-`.
 */
export default function Mensagem({ mensagem }: { mensagem: TipoMensagem }) {
  const doUsuario = mensagem.papel === "usuario";

  return (
    <div className={`flex ${doUsuario ? "justify-end" : "justify-start"}`}>
      <div className="max-w-[85%] space-y-1">
        <span className="block px-1 text-xs font-medium text-suave">
          {doUsuario ? "Você" : "Agente"}
        </span>

        <div
          className={
            doUsuario
              ? "rounded-2xl rounded-br-md bg-bolha-usuario px-4 py-2.5 text-bolha-usuario-texto"
              : "rounded-2xl rounded-bl-md border border-borda bg-bolha-agente px-4 py-2.5"
          }
        >
          {doUsuario ? (
            // `whitespace-pre-wrap` preserva as quebras de linha que a pessoa digitou.
            <p className="whitespace-pre-wrap text-sm leading-relaxed">
              {mensagem.conteudo}
            </p>
          ) : (
            <div className="text-sm leading-relaxed [&_a]:text-destaque [&_a]:underline [&_code]:rounded [&_code]:bg-fundo [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em] [&_li]:my-0.5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_strong]:font-semibold [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {mensagem.conteudo}
              </ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
