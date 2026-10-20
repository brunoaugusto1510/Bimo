"use client";
import type { AcaoDoRascunho } from "@/lib/edicao/pedido-de-rascunho";

type Props = {
  /** Somente leitura (renomeação em voo, recuperação de rascunho): os botões ficam parados. */
  desabilitado: boolean;
  aoPedir(acao: AcaoDoRascunho): void;
};

const BOTOES: readonly { acao: AcaoDoRascunho; rotulo: string }[] = [
  { acao: "continuar", rotulo: "Continuar" },
  { acao: "resumir", rotulo: "Resumir seleção" },
  { acao: "melhorar", rotulo: "Melhorar seleção" },
];

/**
 * "Bimo sugere": Continuar escreve a partir do cursor; Resumir e Melhorar trabalham sobre o trecho selecionado.
 * O `mousedown` é cancelado para o clique não desfazer a seleção nem tirar o foco do texto. O resultado nunca
 * entra sozinho: vira uma proposta que a pessoa aceita ou descarta.
 */
export default function BarraDoBimo({ desabilitado, aoPedir }: Props) {
  return (
    <div role="group" aria-label="Bimo sugere" data-bimo-sugere className="mb-2 flex flex-wrap items-center gap-2">
      <span aria-hidden="true" className="text-meta text-texto">Bimo sugere</span>
      {BOTOES.map(({ acao, rotulo }) => (
        <button key={acao} type="button" aria-disabled={desabilitado || undefined}
          onMouseDown={(evento) => evento.preventDefault()} onClick={() => { if (!desabilitado) aoPedir(acao); }}
          className="min-h-10 rounded-full border border-borda px-4 text-controle font-semibold text-texto transition-[background-color,transform] hover:bg-painel-alt motion-safe:active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-destaque aria-disabled:bg-desabilitado aria-disabled:text-desabilitado-texto aria-disabled:hover:bg-desabilitado">
          {rotulo}
        </button>
      ))}
    </div>
  );
}
