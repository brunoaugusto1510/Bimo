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
      className="pointer-events-auto w-full max-w-md rounded-card border border-borda bg-painel p-4 shadow-foco"
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
          className="-mt-1 -mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-suave transition-colors hover:bg-painel-alt hover:text-texto"
        >
          ✕
        </button>
      </div>

      <p className="mt-1 text-xs text-suave">
        {pasta} · {descreverConexoes(conexoes)}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onAbrir}
          className="rounded-full bg-destaque px-3.5 py-2 text-[13px] font-semibold text-sobre-destaque transition-colors hover:bg-destaque-hover"
        >
          Abrir Nota
        </button>
        <button
          type="button"
          onClick={onVizinhos}
          className="rounded-full border border-borda px-3.5 py-2 text-[13px] font-semibold transition-colors hover:bg-painel-alt"
        >
          Ver vizinhos
        </button>
        <button
          type="button"
          onClick={onPerguntar}
          className="flex items-center gap-1.5 rounded-full border border-destaque-texto px-3.5 py-2 text-[13px] font-semibold text-destaque-texto transition-colors hover:bg-destaque-suave"
        >
          <MarcaBimo tamanho={14} />
          Perguntar ao Bimo
        </button>
      </div>
    </section>
  );
}
