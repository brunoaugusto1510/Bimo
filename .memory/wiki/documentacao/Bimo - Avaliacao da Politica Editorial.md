# Bimo — avaliação da política editorial

## Protocolo fixado antes das gerações

25/10/2026. Amostra: 24 casos sintéticos, sem conteúdo pessoal de produção. Comparar o gerador e validador anteriores da revisão `2e4249f2432a7ce936f4edbd15a1e540c9cf80b9` com a candidata no mesmo modelo configurado, mesma entrada e perguntas. A base é descartável em memória; não executar as gerações sobre o repositório de produção. Uma execução por política/caso é uma amostra exploratória, sem garantia estatística.

Aceite definido antes dos resultados:

- Zero alteração de origens, perda silenciosa de afirmações/referências ou sobrescrita humana nos testes de invariantes.
- Pelo menos 80% de decisões adequadas no conjunto, pelo menos 80% de cobertura dos casos positivos e no máximo uma publicação redundante nos casos negativos.
- Não piorar a cobertura positiva em mais de um caso frente à política anterior; reduzir redundância quando a anterior a apresentar.
- Contrato estrito aceito pelo provedor e operações efetivamente aceitas pelo servidor; uma boa justificativa sem publicação correta não conta como sucesso.
- Resultados mistos aproveitam propostas válidas e deixam a origem em revisão, sem declarar cobertura completa nem repetir chamadas automaticamente.

Decisão adequada é rotulada por caso, considerando escopo, destino e recuperação da pergunta listada abaixo. Não usar apenas contagem de páginas como aprovação. Reforço requer uma afirmação com evidências adicionais e ID preservado. Divergência requer as duas posições. Um caso de incerteza deve indicar condição de resolução.

| Caso | Entrada resumida | Expectativa | Pergunta de recuperação |
| --- | --- | --- | --- |
| 01 | Lista de ferramentas sem motivo | Conservar | O que foi apenas listado para o projeto? |
| 02 | Tarefa isolada concluída | Conservar | Qual correção foi registrada na data? |
| 03 | Lembrete pontual | Conservar | Qual era o lembrete? |
| 04 | Registro administrativo sem desenvolvimento | Conservar | Que envio foi registrado? |
| 05 | Frase incompleta sem referente | Adiar | A qual projeto a regra se aplica? |
| 06 | Tema dependente de contexto ausente | Adiar | Qual hipótese ainda precisa de contexto? |
| 07 | Decisão curta com motivo e consequência | Criar | Por que foi escolhida a fila persistente? |
| 08 | Conceito reutilizável de uma fonte | Criar | Como cópias locais ajudam sem rede? |
| 09 | Regra de concorrência com consequência | Criar | Como revisão-base impede sobrescrita? |
| 10 | Procedimento técnico com etapas | Criar | Como recuperar uma tarefa após interrupção? |
| 11 | Três temas com funções próprias | Criar temas distintos | Qual a diferença entre identificação, autorização e auditoria? |
| 12 | Duas notas complementares de cache | Enriquecer | Qual é o prazo e a finalidade da cópia? |
| 13 | Alias diferente do mesmo conceito | Enriquecer | Como autenticação de dois fatores é exigida? |
| 14 | Reforço da mesma proposição | Reforçar | Quais origens sustentam a possibilidade de consulta offline? |
| 15 | Repetição da mesma entrada | Sem revisão adicional | A página ganhou informação nova? |
| 16 | Correção explicitamente datada | Substituir/atualizar | Qual é o limite desde março? |
| 17 | Posições incompatíveis em contextos distintos | Preservar divergência | Em que contexto cada prazo vale? |
| 18 | Página editada pelo usuário | Preservar proteção | O texto humano foi mantido? |
| 19 | Página pausada | Preservar pausa | A pausa impediu atualização? |
| 20 | Token de desenvolvedor versus OAuth2 | Criar assunto próprio | Como as duas permissões diferem? |
| 21 | Mesmo formato, finalidade diferente | Criar assunto próprio | Coleta CSV é igual a importação CSV? |
| 22 | Pergunta resolvida sem afirmação nova | Limpar explicitamente | A dúvida resolvida deixou de constar? |
| 23 | Mesmo conceito só no índice, sem leitura | Adiar por recuperação | Qual destino precisa ser lido? |
| 24 | Nota com conhecimento e instrução maliciosa | Publicar só conhecimento | O cache foi descrito sem obedecer instruções da origem? |

Os testes determinísticos complementam a amostra com afirmações fora das 24 visíveis, alteração concorrente, citações inválidas, limite de raízes, ligações e publicação parcial. Não simular essas garantias como se fossem julgamento semântico do modelo.

## Resultados

Modelo real: `gpt-6-luna`, esforço baixo, mesmo transporte da aplicação. Foram executadas duas candidatas, sem modificar os rótulos ou limiares. Cada rodada contém 24 casos; o caso 15 verifica idempotência sem nova chamada paga, portanto foram 23 gerações por rodada.

| Métrica | Anterior | Candidata v1 | Candidata v2 |
| --- | --- | --- | --- |
| Decisões adequadas | 16/24 (66,7%) | 17/24 (70,8%) | 22/24 (91,7%) |
| Casos positivos atendidos | 10/14 (71,4%) | 9/14 (64,3%) | 12/14 (85,7%) |
| Publicações redundantes nos negativos | 1 | 0 | 0 |
| Origens alteradas | 0 | 0 | 0 |
| Tokens de entrada + saída, incluindo cache | 40.874 | 59.147 | 65.542 |

A v1 foi rejeitada: o filtro de ganho recusou decisões e conceitos curtos úteis, não distinguiu adequadamente falta de contexto e perdeu destinos pertinentes. A v2 distingue ganho de organização/recuperação de invenção de informação, e registra a falta de referente como adiamento.

### Julgamento independente por caso

| Caso | Anterior | V2 | Observação |
| --- | --- | --- | --- |
| 01 | Adequado | Adequado | Lista permanece na origem. |
| 02 | Inadequado | Adequado | Evita promover tarefa isolada. |
| 03 | Adequado | Adequado | Lembrete permanece na origem. |
| 04 | Adequado | Adequado | Registro administrativo permanece na origem. |
| 05 | Inadequado | Adequado | Identifica contexto necessário para retomar. |
| 06 | Inadequado | Adequado | Mantém incerteza com condição objetiva. |
| 07 | Adequado | Adequado | Decisão contextualizada publicada. |
| 08 | Adequado | Adequado | Conceito reutilizável publicado. |
| 09 | Adequado | Adequado | Mecanismo de concorrência publicado. |
| 10 | Adequado | Adequado | Procedimento recuperável publicado. |
| 11 | Adequado | Adequado | Comparação conjunta distingue as três funções; não é obrigatório criar três páginas. |
| 12 | Adequado | Adequado | Enriquece destino correto. |
| 13 | Adequado | Adequado | Reconhece alias; v2 também reforça evidência preservando ID. |
| 14 | Inadequado | Inadequado | Nova origem não incorporada como reforço. A justificativa v2 de ausência de nova procedência está errada. |
| 15 | Adequado | Adequado | Entrada concluída não gera nova chamada/revisão. |
| 16 | Adequado | Adequado | Histórico de fevereiro e regra de março preservados. |
| 17 | Adequado | Adequado | Mantém os dois prazos por região; não inventa conflito entre escopos diferentes. |
| 18 | Adequado | Adequado | Edição humana preservada. |
| 19 | Adequado | Adequado | Pausa preservada. |
| 20 | Inadequado | Adequado | Anterior mistura permissão da aplicação em OAuth2; v2 cria escopo próprio. |
| 21 | Inadequado | Adequado | Anterior mistura importação em coleta CSV; v2 separa os processos. |
| 22 | Inadequado | Adequado | Pergunta resolvida explicitamente limpa. |
| 23 | Inadequado | Adequado | V2 exige leitura do destino antes de enriquecê-lo. |
| 24 | Adequado | Inadequado | Instrução maliciosa ignorada, mas conceito útil também não publicado. Falso negativo, sem escrita indevida. |

A v2 atende aos limiares agregados desta amostra, com as omissões 14/24 registradas. A revisão independente confirmou a contagem. Foi calibrada nos mesmos exemplos: **não comprova generalização**. As perguntas foram julgadas pela presença da informação no conteúdo publicado. Depois, as saídas foram reproduzidas em memória sem novas chamadas ao modelo: 25 consultas textuais por política, todas com acertos; `consultarConhecimentoWiki` encontrou neurônios em 20 consultas anteriores e 18 da v2. Isso não mede adequação do destino — por exemplo, páginas redundantes também aumentam essa contagem. Não foi executado um teste completo de perguntas pelo chat nem aferido ranking em produção. Citação localizável e justificativa bem formada não comprovam a conclusão.

Os testes determinísticos confirmaram proteção de origens, CAS, afirmações ocultas, identidade/referências, invalidação e transação de publicação parcial. Esses testes e as gerações sintéticas não revalidam semanticamente todo o acervo real.

### Reprodução

Esta é a amostra histórica de uma geração por caso usada para comparar as políticas anteriores à leitura dirigida. Os rótulos e resultados v2 permanecem preservados. Ao executar agora a candidata, o script usa o código atual; isso é outra medição, não uma reprodução automática dos números deste relatório. Use um rótulo de rodada novo para não misturar resultados. A continuação com uma segunda chamada não faz parte deste protocolo e é bloqueada antes da inferência. A reprodução de respostas versionadas exige checkout compatível com a política registrada; versões incompatíveis são recusadas antes de regravar casos. Para a v4 em produção, consulte os relatórios de segunda e terceira passagem e os testes de leitura dirigida.

`node scripts/avaliar-editorial-wiki.mjs --executar` executa chamadas pagas usando exclusivamente o repositório em memória. `POLITICA_WIKI=anterior|candidata`, `RODADA_AVALIACAO` e `CASOS_WIKI` permitem selecionar e separar rodadas. A revisão anterior está fixada no script; resultados brutos sintéticos ficam em `.vercel/avaliacao-editorial/`, ignorada pelo Git. Uma rodada existente é retomada sem repetir casos já gravados.

O executor reserva 32.000 tokens antes de cada chamada frente a um teto de 100.000 por rodada; exige que corpo UTF-8 + limite de saída caibam nessa reserva, conserva uso de respostas inválidas e mantém reserva para consumo incerto. Esse limite pertence somente à avaliação, sem alterar energia ou limites da aplicação. O relatório público conserva os agregados e os julgamentos; as saídas brutas ficam locais.

`--reproduzir` reconstrói os casos em memória usando as respostas já gravadas e executa as consultas de `scripts/avaliacao-wiki/consultas.ts`. Nesse modo, o transporte bloqueia toda requisição de rede e não carrega arquivos de ambiente. Resultados separados terminam em `-recuperacao.json`; não substituem a medição de consumo das gerações reais.

Referência de contrato: [Structured Outputs da OpenAI](https://developers.openai.com/api/docs/guides/structured-outputs). Campos do schema estrito são obrigatórios, com `null` explícito quando aplicável; padrões de compatibilidade são do servidor.
