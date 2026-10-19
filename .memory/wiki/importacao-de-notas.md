# Importação de notas do GitHub — Fase 5

Implementada em 2026-10-16, sem commit/push. Entrada: `npm run importar-notas -- --limite 3`.

- `src/lib/importacao-de-notas.ts` recebe fonte, repositório e opções injetados; o script só carrega configuração, adaptador e imprime o relatório.
- Simulação é o padrão, inclusive com `--sobrescrever`: nenhuma chamada de escrita. Exige conexão de leitura com o banco para comparar conteúdo existente.
- Downloads com oito trabalhadores; escritas sequenciais e em ordem de origem. Simulação mantém projeção em memória das criações para detectar colisões entre arquivos da origem.
- Identificação exata por pasta/título; colisões de caixa são relatadas com ambos os caminhos. O resultado `titulo-em-uso` do índice também é tratado, sem sobrescrever colisões.
- Conteúdo preservado integralmente; tags extraídas por `extrairTags`. Datas históricas não são buscadas: novas notas recebem as datas da importação.
- Divergência só permite escrita com `--sobrescrever` e `--executar`; atualização usa a revisão recém-lida e checkpoint. Conflitos são falhas, sem retry que poderia sobrescrever outra edição.
- Listagem truncada com execução exige `--pasta`. O filtro de pasta usa fronteira de segmento e precede `--limite`.
- Erros por nota não interrompem as demais. Detalhes de drivers/APIs não vão para logs. Falhas e colisões produzem código 1.
- `tsx --conditions=react-server --tsconfig tsconfig.json` permite o adaptador `server-only` no CLI; alias `@/` e imports relativos verificados localmente. Usa `dotenv/config`; nenhuma variável nova exigida.

## Evidência e limites

TDD: primeiro execução falhou por módulo ausente; depois 23 testes focados passaram. ESLint pedido passou. TypeScript global encontrou erros em arquivos das tarefas concorrentes (agente/ferramentas e testes do banco); nenhuma alteração foi feita nesses arquivos.

`npm test` executado com `DATABASE_URL` vazia apenas no subprocesso, para evitar escritas reais da suíte de integração: 917 passaram, 30 falharam, 35 pulados; cinco suítes falharam (instrução do agente, resolvedor do agente, ferramentas, unidade do banco e integração textual que importa cliente sem URL). Estado sujeito às tarefas concorrentes.

Simulação real com limite 3 iniciou, carregou o adaptador e falhou na etapa de listar notas do GitHub; código 1 e nenhuma gravação. Não houve execução com `--executar`, migração ou verificação de escrita real.

`npm i -D tsx` foi tentado, mas rede/cache foram bloqueados. A versão 4.23.12 já estava instalada e registrada como dependência transitiva no lockfile. Foi promovida para devDependency direta em package.json e na raiz do lockfile, reutilizando os metadados existentes. O comando funciona localmente; instalação limpa permanece sem verificação nesta sandbox.
