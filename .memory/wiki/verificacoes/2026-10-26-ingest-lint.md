# MemWiki — ingestão e lint de 26/10/2026

Execução dos fluxos `/memwiki-ingest` e `/memwiki-lint` definidos no `AGENTS.md`. Não são scripts npm nem o processamento das notas da pessoa pelo modelo. Esta execução sintetiza conhecimento do repositório e verifica sua memória documental.

## Escopo da ingestão

Base inicial: branch `main`, commit `99e0cc8`, com alterações locais de código e documentação já existentes. A inspeção alcançou as árvores próprias de `src`, `scripts`, `mobile`, `drizzle`, `public` e `.github`, além da MemWiki e das configurações da raiz. O inventário de caminhos foi combinado com leitura dos contratos e módulos principais de cada domínio; não é uma auditoria linha a linha de todos os arquivos.

Foram contados 372 arquivos em `src`, 7 em `scripts`, 155 em `mobile`, 25 em `drizzle`, 5 em `public` e um em `.github`. Havia 171 arquivos de testes web e 32 mobile; nenhum resultado de execução de testes é inferido dessas contagens.

Não houve leitura de valores de `.env`, execução de modelos, consulta de produção, migração de banco ou alteração de código do aplicativo. Dependências, arquivos gerados, cópias de trabalho de outros agentes e dados locais da infraestrutura não foram ingeridos. A pasta `.memory/.raw/` não continha arquivos no inventário e não foi modificada.

## Conhecimento incorporado

- [Stack](../stack.md): versões do lockfile web, manifesto mobile, estrutura, comandos e limites operacionais.
- [Padrões](../patterns.md): contratos de identidade, concorrência, autorização, estado da interface e publicação de conhecimento.
- [Decisões](../decisions.md): escolhas existentes, sem criar nova autorização de produto.
- [Problemas](../bugs.md): divergência documental confirmada e limites da evidência disponível.
- Cinco páginas de domínio, ligadas diretamente no [índice](../index.md), para evitar concentração de todo o conhecimento no contexto inicial.

Os 25 documentos migrados foram preservados. A pesquisa de LLM Wiki de 23/10 e os ensaios de 25–26/10 continuam sendo registros datados; a síntese atual aponta para eles sem transformar resultados históricos em nova verificação remota.

## Achados do lint inicial e tratamento

| Achado | Situação inicial | Tratamento |
| --- | --- | --- |
| Stack, padrões e problemas vazios | Três arquivos continham apenas modelos de instrução | Preenchidos com informação conferida no código e nos manifestos |
| Contexto inicial incompleto | Informava que a ingestão ainda não tinha ocorrido | Atualizado com domínios, base observada e limites de verificação |
| Ausência de sínteses por domínio | Só havia as páginas-base e documentação integral | Criadas cinco páginas e adicionadas ao índice |
| Links locais na MemWiki | 126 referências válidas na checagem que exclui blocos de código; nenhuma quebrada | Checagem repetida após as edições |
| Referências a `docs/` | Quatro menções no registro da migração e contexto, sem links quebrados | Preservadas como histórico; não são destinos ativos |
| Limites do chat divergentes no README | README informa cinco voltas e 45 s; código observado informa 12 e 150 s | Registrado em problemas e hot; alinhar documentação após confirmar os limites aprovados |

A divergência do README permanece como **aviso documental aberto** fora das páginas corrigidas. Não foi resolvida modificando o comportamento do agente. O lint não usa o README desatualizado como fonte dos limites atuais.

## Critérios da checagem final

- Resolver links Markdown relativos e wikilinks fora de blocos e trechos de código, desconsiderando URLs externas e exemplos.
- Conferir que todas as páginas da MemWiki podem ser alcançadas a partir do índice.
- Identificar páginas vazias ou ainda limitadas ao modelo inicial.
- Conferir presença de contexto, próximos passos, referências de domínio e registro da execução.
- Validar os caminhos locais apresentados como fontes nas novas páginas.
- Conferir espaços no diff; evitar alterar formatação histórica dos documentos migrados.

Esses critérios verificam a estrutura e a consistência documental observável. Não provam que cada afirmação histórica continua válida nem validam consultas externas, interface, contenção de banco, qualidade do modelo ou cobrança. A implementação está em evolução e os apontamentos precisam ser reavaliados quando o código mudar.

## Resultado final

- 38 páginas na MemWiki, incluindo os 25 documentos migrados e cinco novas sínteses de domínio.
- Nenhuma página vazia ou órfã; todos os documentos são alcançáveis pelo índice.
- 254 links locais de navegação válidos e nenhum quebrado. Exemplos de wikilinks em código não são tratados como páginas de memória ausentes.
- Nenhum espaço final introduzido nas páginas novas; `git diff --check` sem erro.
- Um aviso documental permanece aberto: alinhar os limites do chat no README após conferir a configuração aprovada do agente e da rota.

A verificação não executou suites do aplicativo, ESLint, build, modelos ou serviços externos. O resultado é da ingestão e do lint da MemWiki.
