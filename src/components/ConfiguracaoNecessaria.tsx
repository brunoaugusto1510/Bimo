type Props = {
  mensagem: string;
  /** As variáveis de ambiente que a fonte escolhida pede. Sem elas, vale a lista do banco. */
  variaveis?: string[];
};

/**
 * Tela mostrada no lugar da interface normal quando as notas não puderam ser
 * carregadas — `.env` faltando, banco sem configurar, etc. Em vez de esconder o problema atrás de dados de
 * exemplo, mostra a mensagem de erro (que já vem clara de quem falhou) e o que
 * fazer para corrigir.
 */
export default function ConfiguracaoNecessaria({ mensagem, variaveis }: Props) {
  return (
    <div className="flex h-full items-center justify-center px-4">
      <div className="max-w-md rounded-painel border border-borda bg-painel p-6 text-center">
        <h1 className="text-base font-semibold">Não consegui ler as suas notas</h1>
        <p className="mt-2 text-sm text-suave">{mensagem}</p>

        <div className="mt-4 rounded-bloco bg-painel-alt p-3 text-left text-xs text-suave">
          <p className="font-medium text-texto">Cheque no .env:</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-4">
            {variaveis ? (
              variaveis.map((variavel) => (
                <li key={variavel}>
                  <code>{variavel}</code>
                </li>
              ))
            ) : (
              <>
                <li>
                  <code>DATABASE_URL</code> — a conexão com o banco das notas
                </li>
                <li>
                  <code>USER_ID_PADRAO</code> — o usuário dono das notas
                </li>
              </>
            )}
          </ul>
        </div>

        <p className="mt-4 text-xs text-suave">
          Veja <code>.env.example</code> para o formato completo.
        </p>
      </div>
    </div>
  );
}
