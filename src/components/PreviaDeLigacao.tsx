import type { PreviaDeNota } from "@/lib/cliente-de-notas";

type Props = {
  /** O `id` do DOM, que o link usa em `aria-describedby`. */
  id: string;
  previa: PreviaDeNota;
  aoAbrir: (opcoes: { novaAba: boolean }) => void;
};

/**
 * O cartão que aparece ao passar o mouse sobre uma `[[ligação]]`: título, pasta e
 * o começo da nota, com os atalhos para abri-la. Só tem `span` por dentro porque
 * mora dentro de um parágrafo, onde um `div` seria HTML inválido.
 */
export default function PreviaDeLigacao({ id, previa, aoAbrir }: Props) {
  return (
    <span
      role="tooltip"
      id={id}
      className="absolute top-[calc(100%+6px)] left-0 z-20 block w-80 max-w-[85vw] rounded-painel border border-borda bg-painel p-3.5 text-left font-normal shadow-foco motion-safe:animate-entrada"
    >
      <span className="block text-sm font-semibold break-words text-texto">{previa.titulo}</span>
      {previa.trecho && <span className="mt-1.5 block text-controle text-pretty text-texto">{previa.trecho}</span>}
      <span className="mt-2 mb-3 block text-meta text-suave">{previa.pasta?.split("/").join(" / ") ?? "Sem pasta"}</span>

      <span className="flex gap-2">
        <button
          type="button"
          onClick={() => aoAbrir({ novaAba: false })}
          className="min-h-10 rounded-full bg-destaque px-3.5 text-controle font-semibold text-sobre-destaque transition-[background-color,transform] hover:bg-destaque-hover motion-safe:active:scale-[0.96]"
        >
          Abrir Nota
        </button>
        <button
          type="button"
          onClick={() => aoAbrir({ novaAba: true })}
          className="min-h-10 rounded-full border border-borda px-3.5 text-controle font-semibold text-texto transition-[background-color,transform] hover:bg-painel-alt motion-safe:active:scale-[0.96]"
        >
          Abrir ao lado
        </button>
      </span>
    </span>
  );
}
