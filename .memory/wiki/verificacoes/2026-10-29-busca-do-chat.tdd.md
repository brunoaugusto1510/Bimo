# Busca do chat por assuntos e índice de neurônios — 29/10/2026

Implementação local autorizada pelo usuário após o exemplo de busca por `blockchain tokenização tokens`. Base: `main`, HEAD `9a50857`. Os cenários vieram da conversa; não houve arquivo de plano separado.

## Comportamento entregue

- O agente é orientado a começar pelo índice, abrir neurônios relevantes e conferir fontes quando necessário. Essa orientação não força uma chamada quando o modelo decide responder sem ferramentas.
- `buscar_notas` aceita `consultas` opcional: até quatro buscas adicionais por assunto/sinônimo, com 1–160 caracteres por entrada. A consulta original mantém seus termos e seu ranking.
- Uma consulta simples sem resultados pode ser ampliada em até quatro termos úteis distintos. Aspas, operadores e pontuação não são desfeitos automaticamente. Consultas específicas que já encontram material não são ampliadas sem buscas adicionais explícitas.
- Os resultados são deduplicados por identidade. Depois dos acertos originais, os demais assuntos são intercalados dentro do limite global de 1–20 notas. Cada consulta utiliza o ranking do repositório; não há nova pontuação semântica.
- A resposta informa as buscas executadas, suas contagens e a ampliação; adverte que um resultado separado não comprova correspondência a todos os termos.
- Antes de pesquisar as notas, a ferramenta obtém o índice relevante da Wiki (até 20 entradas; o índice separado conserva o teto de 150). O índice filtra também aliases. Mesmo com zero notas, o modelo recebe caminhos de neurônios que pode abrir.
- O recibo informa a consulta ao índice quando há neurônios; seus IDs entram no passo de busca do grafo como candidatos. Isso não registra leitura do texto completo.
- A falha do índice não impede a busca normal. A ausência de Wiki continua suportada.

## Evidência RED

Comando executado antes das mudanças de produção:

```powershell
npx.cmd vitest run src/lib/busca-do-agente.test.ts src/lib/ferramentas-openai.test.ts
```

Resultado: 2 arquivos, **14 testes falharam e 5 passaram**. As falhas incluíram o zero do exemplo, consultas adicionais ignoradas, falta de validação e ausência de índice na resposta. Os testes executaram e a fixture publicou um neurônio com gerador local determinístico; não houve chamada de modelo.

## Evidência GREEN e regressões

```powershell
npx.cmd vitest run src/lib/busca-do-agente.test.ts src/lib/ferramentas-openai.test.ts src/lib/tests/ferramentas.test.ts src/lib/wiki/rede.test.ts src/lib/wiki/regressoes.test.ts src/lib/instrucao-do-agente.test.ts src/lib/agente-openai.test.ts src/lib/tests/agente.test.ts --coverage --coverage.include=src/lib/busca-do-agente.ts --coverage.reporter=text --coverage.reporter=json-summary
```

Resultado: **137 testes passaram em 8 arquivos**. Cobertura V8 do novo `src/lib/busca-do-agente.ts`: **100% de linhas, instruções, funções e branches**. Essa porcentagem não descreve a cobertura de todo o aplicativo.

| Garantia | Evidência |
| --- | --- |
| O exemplo recupera os dois assuntos após zero na consulta conjunta | `busca-do-agente.test.ts`: recupera os dois assuntos do print |
| Busca específica bem-sucedida preserva sua consulta e não amplia | preserva a busca específica |
| Buscas explícitas completam resultados sem duplicar identidades | combina consultas explícitas |
| Um assunto não ocupa todo o limite antes do seguinte | distribui o limite entre os assuntos |
| Aspas, operadores e pontuação não são reescritos | quatro casos de sintaxe explícita |
| Quantidade de consultas, entradas inválidas e duplicatas são controladas | limites, validação e deduplicação |
| Ausência ou falha da Wiki mantém a busca de notas | testes sem Wiki e índice com falha |
| Um alias recupera o neurônio no índice, mesmo com zero notas, e o caminho pode ser aberto com evidências | fixture de publicação local → busca → índice → `ler_nota` |
| O schema estrito da ferramenta transporta consultas opcionais anuláveis | `ferramentas-openai.test.ts` |
| Fluxos anteriores de leitura, edição, eventos e Wiki continuam passando | demais sete arquivos selecionados |

Também executados com sucesso:

```powershell
npx.cmd tsc --noEmit --incremental false
npx.cmd eslint src/lib/busca-do-agente.ts src/lib/busca-do-agente.test.ts src/lib/ferramentas.ts src/lib/ferramentas-openai.test.ts src/lib/instrucao-do-agente.ts src/lib/wiki/consulta.ts
```

## Limites e entrega

Sem testes contra banco real, leitura de `.env`, chamadas reais de modelo, embeddings, migração ou deploy. As regressões de Responses utilizam provedor simulado. A qualidade da escolha de ferramentas pelo modelo real, a consulta ao acervo do usuário e a latência de produção ainda não foram verificadas.

A ampliação automática depende de correspondência textual; não descobre sinônimos sem que estejam nos aliases ou nas consultas produzidas pelo modelo. Consultas adicionais aumentam as operações de leitura (até cinco buscas textuais no total). O índice também acrescenta leituras e contexto, com teto de entradas.

Sem commits ou checkpoints Git nesta entrega; a evidência RED/GREEN fica preservada aqui. O ponteiro preexistente `.claude/worktrees/login-multiusuario` e a documentação das etapas anteriores desta conversa foram preservados.
