# Bimo — segunda passagem dos neurônios

## Escopo executado

Pedido: aplicar as recomendações do primeiro ensaio e repetir a passagem pelas notas. Política `sintetica-v3`, modelo `gpt-6-luna`, motor real `processarWiki`/`gerarConhecimentoWiki`, repositório e fila de produção no Supabase. Execução local do motor em 26/10/2026, das **08:57:46 às 08:58:49, horário de Brasília** (11:57:46–11:58:49 UTC). Não foi simulação.

Reavaliadas as mesmas seis origens, todas na revisão 1: 2590, 2593, 2595, 2592, 2591 e 2594. A ordem priorizou os problemas identificados anteriormente. A retomada abriu uma nova geração apenas desses trabalhos, com conferência de dono, revisão e posse; nenhuma origem foi editada para provocar a execução.

Entre os ensaios, o processamento normal avançou: o ponto inicial desta execução já tinha 15 neurônios e 37 leituras concluídas, contra 14 e 29 ao final do ensaio anterior. O índice também cresceu durante esta passagem. Portanto, é uma comparação exploratória dos mesmos casos, não um experimento isolando somente a mudança de prompt.

## Correções implementadas

- Papéis explícitos: origem e candidatas pessoais podem fornecer evidências; somente neurônios gerenciados e disponíveis podem receber edição. Documentação pessoal semelhante não comprova existência de um neurônio.
- Código e documentação complementar podem sustentar uma síntese de fluxo. As diferenças devem preservar a procedência e a incerteza sobre qual versão vigora, sem afirmar execução ou testes do código.
- Leituras parciais são identificadas no contexto.
- Adiamento distingue falta de contexto da origem e falta de leitura de neurônio. Este último exige até três IDs válidos do índice ainda não lidos; o servidor confere e oferece uma única continuação. No máximo duas chamadas, prazo compartilhado de 40 segundos, reserva/consumo separados e nova conferência de revisão/proteção.
- Retomada operacional por ID/revisão, sem alteração das origens e sem reabertura automática do acervo. O executor do ensaio reivindica explicitamente o ID selecionado.
- A reserva pode reduzir candidatas e índice menos prioritários quando falta saldo, preservando origem, dependentes selecionadas e leituras dirigidas. O teto diário permanece **200.000 tokens**; nenhum controle de energia de produto foi acrescentado.

Não houve migração, tela, alteração de agendamento, fusão ou exclusão de neurônios.

## Resultado confirmado

| Medida | Antes | Depois |
| --- | --- | --- |
| Origens elegíveis | 389 | 389 |
| Leituras concluídas | 37 | 37 |
| Pendentes | 351 | 351 |
| Impedidos/em revisão | 1 | 1 |
| Neurônios distintos | 15 | 17 |
| Tokens comprometidos no dia | 74.060 | 129.889 |
| Saldo diário | 125.940 | 70.111 |

Foram **seis chamadas, 55.829 tokens, três publicações: duas criações e um enriquecimento**. Duas decisões conservaram a origem; uma adiou por contexto da origem. Nenhuma proposta foi descartada integralmente pelo validador. A contagem de concluídos permaneceu igual porque a origem SuperLógica saiu de revisão e a origem MDC entrou em revisão.

Conferência de snapshots: **zero alterações de conteúdo ou revisão nas 389 notas pessoais**. Entre os neurônios anteriores, somente 3503 mudou, pelo enriquecimento autorizado, da revisão 1 para a 2. Não houve exclusão. Os novos 3507 e 3508 nasceram na revisão 1.

## Análise por caso

| Origem | Resultado observado | Avaliação |
| --- | --- | --- |
| 2590 — Código Lambda PDFManual | Criou **3507 — Fluxo de extração de texto de PDF com S3 e Lambda**, com duas afirmações e duas raízes pessoais: 2590 e 2614. | Ganho concreto: reúne upload/invocação da aplicação e processamento da Lambda. Contudo, o texto diz que retorna JSON e **depois** tenta excluir o objeto; no código, a tentativa de exclusão ocorre **antes** do retorno. Deve ser revisto. A diferença sobre prefixo `pdfs/` ficou como pergunta, mas a documentação 2879 não entrou nas evidências publicadas. |
| 2593 — Implementacao SuperLogica Portal | Enriqueceu **3503 — Listagem unificada de clientes de APIs e origem local**. Preservou três afirmações antigas, acrescentou três, manteve a ligação 3486 e passou a duas raízes: 2586 e 2593. | Corrigiu o adiamento anterior baseado em classificar nota pessoal como neurônio não lido. Distinguiu a listagem do portal da tela Livewire de personalização e preservou a ressalva sobre teste funcional. O destino é defensável; continua importante evitar que cresça para uma página genérica sobre qualquer integração. |
| 2595 — Middleware (IntegraçaoToken) | Criou **3508 — Autenticação de integrações SNDesk por assinatura HMAC**, com três afirmações, duas raízes (2595 e 2799), uma divergência e uma pergunta. | Reuniu mecanismo de assinatura e documentação com outro fluxo, sem escolher qual vigora. É uma melhora sobre conservar somente por serem notas pessoais. Algumas citações selecionadas são estreitas para todas as cláusulas da afirmação: por exemplo, a primeira cita o filtro por domínio, mas não a linha do retorno HTTP 401, embora ela exista na origem. |
| 2592 — Funcionalidade API Bling | Conservou na origem. | Continua justificando a ausência de publicação pela documentação pessoal mais abrangente. Isso não prova, por si só, que não há ganho de síntese. A distinção de papéis está no contexto, mas a tendência a conservar neste caso permanece; não considerar este ponto resolvido apenas pela mudança do contrato. |
| 2591 — Fatorial | Conservou na origem por inconsistências no código. | Evitou criar uma síntese sobre fatorial a partir do título quando o conteúdo é MDC. Decisão defensável. |
| 2594 — MDC(maior divisor comum) | Adiou por `contexto_da_origem`, pedindo esclarecimento da intenção/código. | A cautela é defensável. Entretanto, o conteúdo é igual ao de 2591 e recebeu estado diferente: conservação versus revisão. Essa consistência editorial ainda precisa ser avaliada com mais casos; não significa que seja obrigatório corrigir o código pessoal. |

## Limites descobertos

1. **Localizar uma citação não comprova toda a semântica da afirmação.** A ordem incorreta no PDF passou pela validação de evidências. A presença de todas as informações na origem não substitui citações que sustentem cada cláusula relevante.
2. **Divergência malformada pode desaparecer sem bloquear a publicação.** No PDF, o modelo usou `nova:2` nos dois lados. O validador existente ignora pares da mesma afirmação; a síntese foi publicada sem esse par, mantendo a pergunta. Não houve perda de uma divergência anterior, mas a proposta estruturada não foi preservada. A melhoria seguinte deve recusar/sinalizar a estrutura inválida e exigir afirmações distintas com fontes próprias.
3. **Leitura dirigida não foi acionada nesta amostra real:** cada uma das seis notas recebeu somente uma chamada. O caminho de continuação foi validado em testes locais, incluindo persistência/consumo, não demonstrado por inferência de produção neste ensaio.
4. A recuperação ainda traz candidatas pouco relacionadas. Não houve alteração do ranking nesta entrega.
5. Esta amostra participou da calibração da política. São necessários exemplos inéditos e revisão das publicações antes de concluir que a melhoria generaliza para todo o acervo.

A nova regra mostrou melhora prática em reunir origens e enriquecer um destino existente, mas **não aprova uma reconstrução em massa nem certifica todos os neurônios como corretos**. Não foram apagadas páginas para testar a política, nem iniciada uma varredura extra do acervo inteiro. A correção editorial do PDF e a validação de divergências ficam identificadas como próximas pendências; não foram corrigidas manualmente no banco neste ensaio.

## Validação e publicação

- **244 testes em 24 arquivos da Wiki passaram**, incluindo dez testes de leitura dirigida e 32 de persistência local em PGlite. TypeScript, ESLint dos arquivos alterados e `git diff --check` passaram. Não foram executadas as suítes de integração que criam/apagam usuários no Supabase real.
- Revisão independente do código sem bloqueadores, com 80 testes em cinco arquivos no recorte do revisor.
- Build remoto Vercel `READY`: **dpl_4DT8PvJpEpu7MwaBYkc68RKtqPL8**, promovido e confirmado no alias `bimo-omega.vercel.app` antes do ensaio. `/login` retornou 200; `/api/wiki/cerebro` e `/api/wiki/processar`, 401 sem sessão/segredo. Isso verifica acesso, não o fluxo completo no navegador. Duração exata do build e varredura de logs de produção não foram aferidas nesta retomada; drains e monitoramento não foram inspecionados.
- Reversão de código disponível pela publicação anterior **dpl_GRnCEg18jz9QMhY3NuM28PF8tSpG**. Reverter código não desfaz publicações já realizadas.
- Registro completo e snapshots cifrados: `.vercel/ensaio-neuronios/registro-1793015866437.json`, ignorado pelo Git. Este relatório evita copiar o conteúdo integral das notas.
- Alterações permanecem em `fix/processamento-acervo-wiki`, **sem commit ou push** nesta execução.

## Atualização posterior

As pendências acima motivaram a política v4 e as correções revisadas do PDF e do middleware. O histórico deste ensaio foi preservado; o estado posterior, os testes e a nova passagem estão no [relatório de correções e terceira passagem](./Bimo%20-%20Correcoes%20e%20Terceira%20Passagem%20-%202026-10-26.md).
