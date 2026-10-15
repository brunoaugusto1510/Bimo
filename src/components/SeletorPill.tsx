type Opcao<V extends string> = { valor: V; rotulo: string };

type Props<V extends string> = {
  opcoes: readonly Opcao<V>[];
  valor: V;
  onChange: (valor: V) => void;
  /** Nome do grupo para leitor de tela (o seletor não tem texto visível que o explique). */
  rotulo: string;
};

/**
 * "PillToggle" do design system: seletor em pílula com exatamente uma opção
 * ativa — azul com texto branco; as outras em `texto-suave`. Usado no header
 * para alternar entre Bimo (chat) e Notas (grafo).
 *
 * São botões com `aria-pressed` num grupo, e não abas: as duas telas ficam
 * montadas ao mesmo tempo (o chat não pode perder a conversa), então não há
 * painéis trocando de lugar que justifiquem o papel de `tablist`.
 */
export default function SeletorPill<V extends string>({ opcoes, valor, onChange, rotulo }: Props<V>) {
  return (
    <div
      role="group"
      aria-label={rotulo}
      className="inline-flex gap-0.5 rounded-full border border-borda bg-fundo p-1"
    >
      {opcoes.map((opcao) => {
        const ativa = opcao.valor === valor;
        return (
          <button
            key={opcao.valor}
            type="button"
            aria-pressed={ativa}
            onClick={() => {
              if (!ativa) onChange(opcao.valor);
            }}
            // O `after` alarga a área de toque para ~41px de altura sem engordar a pílula (o
            // design pede ~33px); só na vertical, para não invadir a opção vizinha.
            className={`relative rounded-full px-4 py-1.5 text-[13.5px] font-semibold transition-[color,background-color,transform] after:absolute after:inset-x-0 after:-inset-y-1 after:content-[''] motion-safe:active:scale-[0.96] md:px-[18px] md:py-[7px] ${
              ativa ? "bg-destaque text-sobre-destaque" : "text-suave hover:text-texto"
            }`}
          >
            {opcao.rotulo}
          </button>
        );
      })}
    </div>
  );
}
