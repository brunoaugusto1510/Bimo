/**
 * Tela mostrada no lugar da interface normal quando o vault não pôde ser
 * carregado — `.env.local` faltando, token sem permissão, repositório errado,
 * etc. Em vez de esconder o problema atrás de dados de exemplo, mostra a
 * mensagem de erro (que já vem clara, de `getGitHubConfig`/`listTree`) e o
 * que fazer para corrigir.
 */
export default function ConfiguracaoNecessaria({ mensagem }: { mensagem: string }) {
  return (
    <div className="flex h-full items-center justify-center px-4">
      <div className="max-w-md rounded-xl border border-borda bg-painel p-6 text-center">
        <h1 className="text-base font-semibold">Não consegui ler o seu vault</h1>
        <p className="mt-2 text-sm text-suave">{mensagem}</p>

        <div className="mt-4 rounded-lg bg-fundo p-3 text-left text-xs text-suave">
          <p className="font-medium text-texto">Cheque no .env.local:</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-4">
            <li>
              <code>VAULT_REPO</code> — no formato <code>dono/repositorio</code>
            </li>
            <li>
              <code>GITHUB_TOKEN</code> — um Personal Access Token com permissão de
              leitura no repositório
            </li>
            <li>
              <code>VAULT_BRANCH</code> e <code>VAULT_SUBPATH</code> — opcionais
            </li>
          </ul>
        </div>

        <p className="mt-4 text-xs text-suave">
          Veja <code>.env.local.example</code> para o formato completo.
        </p>
      </div>
    </div>
  );
}
