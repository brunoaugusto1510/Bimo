"use client";

type Props = { itens: string[]; mensagem?: string };

export default function BarraDeStatus({ itens, mensagem }: Props) {
  return (
    <footer className="flex h-8 shrink-0 items-center justify-end gap-4 border-t border-borda bg-painel-alt px-4 text-meta text-suave tabular-nums">
      <div className="hidden items-center gap-4 md:flex">{itens.map((item, indice) => <span key={indice}>{item}</span>)}</div>
      <span role="status" className="truncate">{mensagem}</span>
    </footer>
  );
}
