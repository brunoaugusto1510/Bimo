type Props = {
  nos: number;
  conexoes: number;
  onAproximar: () => void;
  onAfastar: () => void;
  onEnquadrar: () => void;
};

const formatador = new Intl.NumberFormat("pt-BR");

function contar(quantidade: number, singular: string, plural: string): string {
  return `${formatador.format(quantidade)} ${quantidade === 1 ? singular : plural}`;
}

/**
 * Barra por cima do grafo na aba Notas, como na tela Gráfico do design system:
 * as contagens à esquerda e os controles de câmera à direita (o ◎ é o botão de
 * "enquadrar tudo" do design). Só os próprios elementos recebem toque — o resto
 * é transparente a eventos, para o grafo atrás continuar arrastável.
 */
export default function BarraDoGrafo({ nos, conexoes, onAproximar, onAfastar, onEnquadrar }: Props) {
  return (
    <div className="pointer-events-none flex items-start justify-between gap-2 p-3 md:p-4">
      {/* tabular-nums: as contagens mudam quando as notas mudam, e os dígitos não devem fazer a pílula "tremer". */}
      <p className="pointer-events-auto rounded-full border border-borda bg-painel/90 px-3 py-1.5 text-meta text-suave tabular-nums backdrop-blur-sm">
        {contar(nos, "nó", "nós")} · {contar(conexoes, "conexão", "conexões")}
      </p>

      <div className="pointer-events-auto flex gap-1.5">
        <BotaoDeControle rotulo="Afastar" onClick={onAfastar}>
          −
        </BotaoDeControle>
        <BotaoDeControle rotulo="Aproximar" onClick={onAproximar}>
          +
        </BotaoDeControle>
        <BotaoDeControle rotulo="Enquadrar o grafo" onClick={onEnquadrar}>
          ◎
        </BotaoDeControle>
      </div>
    </div>
  );
}

function BotaoDeControle({
  rotulo,
  onClick,
  children,
}: {
  rotulo: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={rotulo}
      className="flex h-10 w-10 items-center justify-center rounded-full border border-borda bg-painel text-base text-suave transition-[color,transform] hover:text-texto motion-safe:active:scale-[0.96]"
    >
      <span aria-hidden>{children}</span>
    </button>
  );
}
