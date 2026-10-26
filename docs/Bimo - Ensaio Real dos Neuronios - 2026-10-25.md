# Bimo — ensaio real dos neurônios

## Execução

Solicitação: passar o Bimo por algumas notas reais e analisar as publicações e as decisões de não publicar. Execução em 25/10/2026, das 19:33:38 às 19:34:08, horário de Brasília (22:33:38–22:34:08 UTC).

Foi usado o motor atual da Wiki (`processarWiki` e `gerarConhecimentoWiki`), executado localmente contra o repositório de produção do próprio usuário no Supabase. Modelo `gpt-6-luna`, política `sintetica-v2`, fila e teto diário existentes. Não foi uma simulação nem uma geração na Wiki de prévia. As respostas foram registradas junto das transações e eventos reais do Bimo.

Limite pretendido: dez notas diferentes, com até vinte trechos. O executor respeitou a ordem da fila, sem reabrir notas concluídas, forçar revisão ou selecionar somente exemplos favoráveis.

## Resultado confirmado

| Medida | Antes | Depois |
| --- | --- | --- |
| Notas pessoais elegíveis | 389 | 389 |
| Leituras concluídas | 24 | 29 |
| Trabalhos pendentes | 365 | 359 |
| Trabalhos impedidos/em revisão | 0 | 1 |
| Neurônios atuais | 14 | 14 |
| Tokens comprometidos no dia | 111.283 | 159.310 |

- **Seis notas enviadas ao modelo:** cinco conservadas na origem e uma adiada para revisão.
- **Zero propostas de publicação:** nenhum neurônio criado, enriquecido ou excluído. Não houve proposta válida perdida na validação/publicação: o gerador já retornou listas vazias.
- **Sétima nota reivindicada, mas não enviada ao modelo:** a reserva não coube no saldo. O trabalho voltou a aguardar renovação, sem gastar uma chamada.
- **48.027 tokens usados pelo ensaio**, incluindo entrada, saída e tokens de entrada com cache. Saldo diário final: 40.690 tokens.
- **Zero alterações de conteúdo ou revisão nas 389 notas pessoais**, conferidas contra o snapshot anterior. Os neurônios atuais também permaneceram nas mesmas revisões.

Parar por orçamento não significa saldo igual a zero. A próxima leitura exige uma reserva conservadora para o contexto completo e a saída. Essa reserva era maior que o saldo disponível; não foi elevado o teto nem contornada a reserva.

## Análise por nota

As decisões são fatos da execução; o julgamento editorial abaixo é uma análise dos textos efetivamente disponíveis, não uma declaração de que toda nota deve virar página.

| Nota / revisão | Decisão do Bimo | Análise e encaminhamento |
| --- | --- | --- |
| 2590 / 1 — Código Lambda PDFManual | Conservar na origem. Reconheceu download do S3, extração de texto do PDF e tentativa de exclusão; apontou diferença de fluxo em outra nota. | **Oportunidade de síntese a revisar.** O contexto também continha as notas pessoais 2879 (explicação da Lambda), 2614 (upload e invocação) e 2878 (fluxo do sistema). Há material para organizar o fluxo PDF→S3→Lambda e registrar diferenças, preservando qual comportamento veio de cada origem. Uma divergência de implementação não elimina, por si só, a utilidade de uma síntese. Isso não autoriza inventar qual variante é a atual. |
| 2591 / 1 — Fatorial | Conservar na origem. Identificou que o conteúdo trata de MDC, apesar do título. | **Decisão defensável.** O conteúdo coincide com a nota 2594 e tem referências de funções inconsistentes. Evitar uma página de fatorial com base apenas no título foi adequado. Continua possível tratar o exemplo como estudo de recursividade/MDC, com limites explícitos; não é obrigatório publicar uma página para o exercício. |
| 2592 / 1 — Funcionalidade API Bling | Conservar na origem. Considerou que outra documentação pessoal já cobre mais amplamente a integração. | **Não concluir erro apenas pela ausência de publicação.** A origem contém autenticação, renovação, contatos, cache e status; a candidata pessoal 2795 também documenta a integração. A conservação pode evitar repetir uma documentação já útil. Para justificar um neurônio, definir primeiro o ganho concreto de reunir essas notas, mantendo datas, diferenças de escopo e a hipótese indicada como “provavelmente” na origem. A justificativa atual não demonstra essa comparação em detalhe. |
| 2593 / 1 — Implementacao SuperLogica Portal | Adiar. Pediu leitura de “sínteses” 2664 e 3486 que supostamente só apareceriam no índice. | **Erro confirmado na justificativa.** A nota 2664 era uma candidata pessoal já apresentada, com `gerenciada=false` e conteúdo `tag`; não era neurônio nem estava no índice de sínteses. A 3486 estava somente no índice, mas a 3503 (listagem de clientes) já tinha sido lida como neurônio candidato e merecia avaliação de pertinência. Não concluir automaticamente que 3503 é o destino correto: a nota nova trata do portal e a página existente, de personalização de clientes. O adiamento preservou dados, mas sua condição contém uma premissa falsa. |
| 2594 / 1 — MDC(maior divisor comum) | Conservar na origem. Apontou inconsistências no código e falta de explicação contextual. | **Decisão defensável**, em conjunto com a duplicata 2591. A existência de duas notas idênticas não é evidência independente. O código não foi compilado/executado neste ensaio; a inconsistência foi examinada no texto. |
| 2595 / 1 — Middleware (IntegraçaoToken) | Conservar na origem. Alegou implementação específica sem síntese própria e candidata não gerenciada. | **Sinal de perda de oportunidade editorial.** O código usa `X-signature`, HMAC SHA-256 e consulta `sndesk_api`; a documentação pessoal 2799 descreve Bearer token e outra tabela. Há uma diferença concreta entre código e documentação que pode justificar uma síntese contextualizada ou lacuna de versão. Uma candidata ser pessoal impede editá-la automaticamente como neurônio, mas não impede usá-la como fonte para uma nova síntese. Não é seguro afirmar qual versão está vigente sem contexto adicional. |
| 2596 / 1 | Sem decisão do modelo. Reserva negada antes da chamada. | **Não analisada.** Não classificar como conservação, erro editorial ou perda de conhecimento. |

## Diagnóstico

1. **A execução e a preservação funcionaram:** fila, contabilização, registro de decisões e bloqueio sem publicação tiveram efeitos verificáveis. As origens permaneceram intactas.
2. **O resultado editorial não deve ser aprovado só porque não houve duplicatas.** O lote expôs oportunidades de reunir código e documentação que não foram exploradas, especialmente em PDFManual e no middleware.
3. **Há confusão verificável entre nota pessoal e neurônio.** No caso SuperLógica, uma candidata pessoal já lida foi descrita como síntese não lida. No middleware, a ausência de gerenciamento foi usada na justificativa de não sintetizar. É necessário separar “pode contribuir como fonte” de “pode receber uma edição automática”.
4. **A recuperação ainda apresenta ruído.** Por exemplo, o contexto de MDC trouxe uma nota de ética, e o contexto da Lambda trouxe uma nota de controlador de domínio Windows. Também houve candidatas pertinentes. O ruído é observável; não foi medido um ranking alternativo nem demonstrada causalidade sobre cada decisão.
5. **A condição de adiamento não tem retomada automática por leitura adicional.** O trabalho 2593 ficou em `revisar`; simplesmente esperar não o fará ler os destinos pedidos. A implementação atual não tem um ciclo de leitura dirigida para resolver essa pendência. Não editar a origem artificialmente apenas para forçar uma nova revisão.
6. **As justificativas precisam melhorar a legibilidade.** Algumas vieram encostadas no teto de 200 caracteres, terminando no meio de uma palavra ou frase. O registro existe, mas sua explicação ficou incompleta; não presumir que ele contém toda a comparação editorial.

## Próximo ajuste recomendado — não executado neste ensaio

- Acrescentar casos de regressão com o formato real “código + documentação pessoal complementar”, em vez de depender apenas de textos conceituais sintéticos.
- Explicitar e verificar quais IDs são origens pessoais, quais são neurônios, quais foram efetivamente lidos e quais aparecem só no índice.
- Fazer o adiamento referenciar destinos estruturados e verificáveis; não aceitar uma condição baseada em classificar uma nota pessoal como neurônio não lido.
- Tratar divergência entre código e documentação como conhecimento contextualizável ou questão aberta, sem escolher arbitrariamente a versão correta e sem descartar automaticamente todo o tema.
- Comparar a política ajustada com estes casos em prévia, sem publicar e sem modificar as origens; só depois considerar uma nova passagem por estes mesmos IDs com reprocessamento explícito e controlado.

Não foram alterados prompt, regras, limites, configuração, agendamento ou estado de retomada para obter um resultado mais favorável. Não houve commit/push. As cinco conservações permanecem concluídas, a decisão SuperLógica permanece em revisão e as outras notas continuam na fila normal.

## Registro privado

Snapshot e respostas completas foram guardados com AES-256-GCM em `.vercel/ensaio-neuronios/registro-1792967618257.json`, ignorado pelo Git, com chave derivada do segredo de sessão existente. O relatório acima evita copiar as notas completas e credenciais. O registro permite inspecionar as decisões e reproduzir o contexto sem repetir as chamadas pagas. Não é um comando de restauração ou autorização de exclusão.
