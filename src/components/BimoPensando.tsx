/**
 * "BimoThinking" do design system: um pequeno grafo cujas arestas se ligam
 * enquanto um pulso azul percorre os nós. É o grafo como "cérebro do Bimo
 * trabalhando" — o design system pede isto no lugar de spinner sempre que o
 * Bimo pensa, busca ou sugere (e só nesses casos: abrir nota não usa).
 *
 * O texto é obrigatório: o grafo sozinho não comunica o estado. A animação
 * (classes `bimo-pensando*`) mora em globals.css e para sozinha com
 * `prefers-reduced-motion`.
 */
export default function BimoPensando({ texto = "Pensando…" }: { texto?: string }) {
  return (
    <div role="status" className="inline-flex items-center gap-2 text-[13px] whitespace-nowrap text-suave">
      <svg className="bimo-pensando h-6 w-16 shrink-0" viewBox="0 0 64 24" aria-hidden>
        <line className="a1" x1="6" y1="14" x2="20" y2="6" />
        <line className="a2" x1="20" y1="6" x2="31" y2="16" />
        <line className="a3" x1="31" y1="16" x2="44" y2="8" />
        <line className="a4" x1="44" y1="8" x2="58" y2="15" />
        <line className="a5" x1="20" y1="6" x2="44" y2="8" />
        <circle className="n1" cx="6" cy="14" r="2" />
        <circle className="n2" cx="20" cy="6" r="2" />
        <circle className="n3" cx="31" cy="16" r="3.5" />
        <circle className="n4" cx="44" cy="8" r="2" />
        <circle className="n5" cx="58" cy="15" r="2" />
      </svg>
      <span>{texto}</span>
    </div>
  );
}
