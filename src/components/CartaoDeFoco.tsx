import MarcaBimo from "./MarcaBimo";

type Props = {
  titulo: string;
  /** Pasta de topo da nota — vira o começo da linha de meta. */
  pasta: string;
  conexoes: number;
  onAbrir: () => void;
  /** Aproxima a câmera do grupo formado pela nota e suas ligações. */
  onVizinhos: () => void;
  onPerguntar: () => void;
  onFechar: () => void;
};

function descreverConexoes(conexoes: number): string {
  if (conexoes === 0) return "sem conexões";
  return conexoes === 1 ? "1 conexão" : `${conexoes} conexões`;
}

/**
 * Cartão de foco do design system (`GraphNode`): aparece por cima do grafo
 * quando uma nota é selecionada. "Abrir Nota" é a ação primária; "Ver vizinhos"
 * é secundária; "Perguntar ao Bimo" é o atalho para levar a nota ao chat, na
 * pílula contornada em azul que o design reserva para o Bimo.
 */
export default function CartaoDeFoco({
  titulo,
  pasta,
  conexoes,
  onAbrir,
  onVizinhos,
  onPerguntar,
  onFechar,
}: Props) {
  return (
    <section
      aria-label="Nota selecionada"
      className="pointer-events-auto w-full max-w-md rounded-card border border-borda bg-painel p-4 shadow-foco motion-safe:animate-entrada"
    >
      <div className="flex items-start gap-2">
        <h2 className="flex min-w-0 flex-1 items-center gap-1.5 text-sm font-semibold">
          <span aria-hidden>📄</span>
          <span className="truncate">{titulo}</span>
        </h2>
        <button
          type="button"
          onClick={onFechar}
          aria-label="Fechar"
          // O `after` leva a área de toque a 40px sem aumentar o botão visível (28px).
          className="relative -mt-1 -mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-suave transition-[color,background-color,transform] after:absolute after:-inset-1.5 after:content-[''] hover:bg-painel-alt hover:text-texto motion-safe:active:scale-[0.96]"
        >
          ✕
        </button>
      </div>

      <p className="mt-1 text-xs text-suave tabular-nums">
        {pasta} · {descreverConexoes(conexoes)}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onAbrir}
          className="min-h-10 rounded-full bg-destaque px-3.5 text-[13px] font-semibold text-sobre-destaque transition-[background-color,transform] hover:bg-destaque-hover motion-safe:active:scale-[0.96]"
        >
          Abrir Nota
        </button>
        <button
          type="button"
          onClick={onVizinhos}
          className="min-h-10 rounded-full border border-borda px-3.5 text-[13px] font-semibold transition-[background-color,transform] hover:bg-painel-alt motion-safe:active:scale-[0.96]"
        >
          Ver vizinhos
        </button>
        <button
          type="button"
          onClick={onPerguntar}
          className="flex min-h-10 items-center gap-1.5 rounded-full border border-destaque-texto px-3.5 text-[13px] font-semibold text-destaque-texto transition-[background-color,transform] hover:bg-destaque-suave motion-safe:active:scale-[0.96]"
        >
          <MarcaBimo tamanho={14} />
          Perguntar ao Bimo
        </button>
      </div>
    </section>
  );
}
