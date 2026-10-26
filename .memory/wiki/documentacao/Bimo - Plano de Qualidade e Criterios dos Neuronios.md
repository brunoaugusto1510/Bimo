# Bimo — plano de qualidade e critérios dos neurônios

Data: 25/10/2026.

Status: implementação autorizada pelo usuário em “Compacte o contexto e execute esse plano”. Política `sintetica-v2` implementada, avaliada e publicada; ver seção 15 para evidências e limites. O restante do documento preserva a especificação que orientou a execução.

## 1. Objetivo e escopo

Analisar os neurônios já criados e preparar critérios verificáveis para criar, enriquecer, relacionar ou editar conhecimento. O resultado esperado é uma base com páginas úteis, assuntos identificáveis e evidências preservadas, com menos publicações que apenas reformulam uma anotação.

Por orientação do usuário, **controle de energia está fora deste plano**. Modos de execução, agendamento, infraestrutura e telas também não são objeto desta revisão. As propostas anteriores permanecem em [Modos de consolidação e energia](./Bimo%20-%20Modos%20de%20Consolidacao%20e%20Energia.md), sem serem incorporadas à implementação aqui preparada.

O plano não prevê apagar, fundir ou reescrever automaticamente os neurônios atuais. Primeiro produz diagnóstico e propostas individuais; alterações reais dependem de uma etapa posterior com escopo definido.

## 2. Base de evidências e limites da análise

A [análise de granularidade](./Bimo%20-%20Analise%20de%20Granularidade%20dos%20Neuronios.md) registrou, em 25/10/2026, 14 neurônios atuais: 13 com uma origem, um com duas, três com uma afirmação e dez sem ligações com outros neurônios. São uma fotografia anterior a este plano; a etapa de inventário deve atualizar esses números antes de executar qualquer revisão.

O total de 15 publicações incluía histórico. Contar neurônios pela revisão mais recente de cada `nota_id`, vinculada à nota existente e ao dono. "Sem ligação com outro neurônio" não significa ausência de sinapse com a origem.

Foram encontrados casos distintos:

- Uma nota de 34 caracteres gerou uma página que basicamente lista ferramentas consideradas para um projeto.
- Anotações curtas de tarefas concluídas viraram páginas próprias com uma afirmação.
- Uma pesquisa de vários temas gerou três páginas temáticas diferentes, o que pode ser adequado.
- Duas notas complementares de Power BI foram consolidadas numa mesma página.

Esses casos justificam melhorar a decisão editorial. Não demonstram que todo neurônio de uma fonte é inadequado nem que reduzir a quantidade de páginas, isoladamente, melhora o sistema.

### Código que deve orientar a implementação

| Área | Estado conferido | Consequência para o plano |
| --- | --- | --- |
| [gerador.ts](../../../src/lib/wiki/gerador.ts) | Pede utilidade, ausência de repetição e enriquecimento, mas sem contrato editorial explícito. | Tornar a escolha do destino uma decisão estruturada. |
| [automacao.ts](../../../src/lib/wiki/automacao.ts) | Até três propostas por trecho; uma afirmação válida pode publicar uma página. | Separar sustentação factual de mérito de publicação. |
| [recuperacao.ts](../../../src/lib/wiki/recuperacao.ts) | Busca textual, aliases, dependências, até seis candidatas e índice limitado. | Verificar se o destino adequado foi disponibilizado antes de atribuir uma criação ao modelo. |
| [afirmacoes.ts](../../../src/lib/wiki/afirmacoes.ts) | O ID depende do texto e das evidências normalizados. | Nova evidência pode mudar o ID; avaliar reforço de evidência sem duplicar a proposição. |
| [observabilidade.ts](../../../src/lib/wiki/observabilidade.ts) | Diagnóstico identifica alguns padrões de duplicata, sem fusão semântica. | Não tratar diagnóstico atual como revisão editorial completa. |
| [tipos.ts](../../../src/lib/wiki/tipos.ts) | Evidências, fontes, afirmações, estrutura e destino de publicação têm contratos próprios. | Preservar revisão, procedência e compatibilidade ao evoluir o contrato. |

## 3. Entregáveis

1. Inventário revisável dos neurônios existentes, com uma recomendação por item.
2. Política editorial inicial, com critérios de utilidade, ganho e destino.
3. Contrato de decisões e operações para geração e validação no servidor.
4. Tabela de parâmetros com valores atuais, proposta e itens a calibrar.
5. Casos de teste e conjunto de perguntas para avaliar qualidade.
6. Propostas de alteração dos neurônios atuais, separadas da futura execução.

## 4. Etapa A — inventário e diagnóstico dos neurônios atuais

### Procedimento

1. Ler somente as revisões mais recentes, respeitando o dono e a existência da nota.
2. Conferir fontes atuais, afirmações, citações, relações e proteção editorial.
3. Comparar o neurônio com suas origens: o que foi organizado, explicado, reunido ou tornado mais fácil de recuperar?
4. Comparar com outras páginas próximas: há assunto equivalente, complementaridade ou sobreposição?
5. Registrar dúvidas como dúvidas; não decidir inutilidade somente pelo tamanho, pelo número de afirmações ou pela quantidade de fontes.

### Ficha por neurônio

| Campo | Conteúdo esperado |
| --- | --- |
| Identidade | ID, título e revisão examinada. |
| Assunto e finalidade | O que a página representa e que pergunta ajuda a responder. |
| Sustentação | Origens, revisões e validade das evidências. |
| Ganho | Diferença útil em relação à leitura da origem. |
| Vizinhos | Páginas com assunto semelhante ou complementar, identificadas por ID. |
| Sobreposição | Afirmações repetidas, diferença de escopo e ambiguidades. |
| Proteção | Edição humana, pausa ou conflito de revisão. |
| Recomendação | Manter, enriquecer, relacionar, revisar escopo ou sugerir consolidação. |
| Justificativa | Evidência observada e interpretação editorial, separadas. |
| Alteração proposta | Texto ou operações pretendidas; vazio se a recomendação for manter. |

**Aceite:** todos os neurônios do inventário recebem uma ficha. Nenhuma recomendação de fusão ou descarte se baseia apenas em compartilhar uma fonte. Nenhuma ficha executa sua própria proposta.

## 5. Etapa B — política editorial

### Três perguntas obrigatórias

| Critério | Pergunta | Evidência de uma decisão adequada |
| --- | --- | --- |
| Utilidade própria | Que pergunta, necessidade ou assunto esta página atende? | Finalidade específica compatível com o conteúdo disponível. |
| Ganho sobre a origem | O que a página acrescenta em organização, compreensão ou recuperação? | Síntese, explicação, comparação, relação, decisão contextualizada ou estrutura reutilizável. |
| Destino adequado | Por que publicar aqui, em vez de conservar na origem ou enriquecer outra página? | Comparação com candidatas pertinentes e escopo próprio. |

Cada critério recebe `suficiente`, `insuficiente` ou `incerto`, com justificativa curta e verificável. Essa classificação é explicação editorial; não é prova automática de que o modelo acertou. A política será calibrada por comparação com avaliações humanas.

### Decisões para uma leitura

| Decisão | Quando usar | Efeito preparado |
| --- | --- | --- |
| Conservar na origem | A anotação já atende ao uso e uma nova página pouco acrescentaria. | Não publicar outro neurônio; reconhecer a leitura concluída quando ela estiver completa. |
| Enriquecer | Há página do mesmo assunto e informação nova pertinente. | Propor operações sobre o ID existente. |
| Relacionar | A novidade útil é uma relação entre conhecimentos existentes. | Propor ligação ou ajuste estrutural justificado. |
| Criar | Há assunto próprio, ganho identificável e sustentação, sem destino existente adequado. | Propor página nova. |
| Adiar a decisão | Faltam contexto, desambiguação ou trecho relevante para uma decisão segura. | Explicar a lacuna; não confundir com leitura concluída sem novidade nem com erro de validação. |

Conservar na origem é um resultado válido, não uma falha. Adiar exige condição objetiva de reavaliação; não pode criar repetição indefinida da mesma entrada sem novo contexto.

### Regras de criação

- Uma fonte pode ser suficiente para um conceito útil. Uma única afirmação também pode ser relevante, como uma decisão importante acompanhada de contexto.
- Uma nota curta não deve ser rejeitada pelo tamanho. Deve falhar no critério de criação quando o único resultado for renomear ou parafrasear o mesmo registro sem ganho.
- Uma nota com vários temas pode originar páginas diferentes quando cada tema tiver finalidade própria. O limite de três propostas não é meta nem obrigação de preenchimento.
- Não criar uma página por palavra, seção, ferramenta citada ou tarefa concluída.
- Conteúdo já atendido por um neurônio deve primeiro ser considerado para enriquecimento, respeitando seu escopo e sua proteção.
- Assuntos relacionados não são necessariamente equivalentes: OAuth2 e token de desenvolvedor podem justificar páginas distintas.
- Classificar uma página como síntese entre fontes exige contribuições de mais de uma origem. IDs diferentes, por si só, não comprovam fontes independentes.
- Sustentação factual continua obrigatória mesmo quando a utilidade editorial for alta.

## 6. Critérios para edição e enriquecimento

| Operação | Condição para propor | Proteção necessária |
| --- | --- | --- |
| Acrescentar afirmação | Informação nova, pertinente ao escopo e sustentada. | Evitar repetir a mesma proposição com outras palavras. |
| Reforçar evidência | Outra origem sustenta uma afirmação já presente. | Preparar evolução da evidência sem duplicar o texto; tratar o efeito sobre o ID atual da afirmação. |
| Substituir afirmação | A fonte corrige, especifica ou atualiza a informação anterior. | Referenciar o ID visível; preservar validade temporal e histórico. |
| Retirar afirmação | Perda de sustentação ou substituição justificada conforme as garantias existentes. | Não apagar uma posição ainda válida apenas porque outra fonte diverge. |
| Registrar divergência | Há afirmações incompatíveis em contextos identificáveis. | Manter evidências de ambos os lados; não inventar uma conciliação. |
| Alterar relações | Existe complementaridade ou associação útil explicável. | Validar IDs e pertinência; fonte compartilhada não obriga ligação. |
| Atualizar perguntas | Há lacuna nova, resolvida ou sem sustentação. | Distinguir manter de limpar explicitamente; não perder perguntas por omissão de campo. |
| Sugerir consolidação | Duas páginas atendem praticamente ao mesmo assunto ou pergunta. | Produzir proposta revisável, sem fundir automaticamente. |

### Invariantes a manter

- Mesma identidade de nota ao enriquecer uma página existente.
- Revisão-base e fontes revalidadas na publicação; nenhuma substituição silenciosa de edição concorrente.
- Respeito à edição humana e à pausa; nenhum caminho alternativo para contornar proteção.
- Só substituir/retirar afirmações que a operação teve condições de examinar; preservar as que ficaram fora do contexto.
- Repetir a mesma entrada não deve gerar nova página ou revisão sem mudança efetiva.
- Notas pessoais continuam como raízes; páginas derivadas não se tornam novas fontes independentes.
- Uma mudança só de estrutura pode ser útil mesmo sem afirmação nova.

### Atenção à identidade das afirmações

O ID atual combina texto e evidências. Portanto, não prometer estabilidade do ID ao adicionar uma fonte sem preparar esse contrato. A implementação deve escolher e testar entre substituição explícita com remapeamento de referências ou evolução da identidade lógica da afirmação. Em ambos os casos, divergências e referências existentes precisam continuar corretas. Não alterar o algoritmo de IDs incidentalmente durante uma mudança de prompt.

## 7. Parâmetros propostos

| Parâmetro | Situação atual | Diretriz inicial |
| --- | --- | --- |
| Perfil editorial | Orientações gerais no prompt. | Preparar um perfil sintético para avaliação controlada; não multiplicar perfis antes de validar o primeiro. |
| Utilidade própria | Pedido genérico de conceitos úteis. | Obrigatória na decisão de criar, com pergunta/finalidade concreta. |
| Ganho editorial | Não há contrato específico. | Exigir ganho identificável; simples reescrita da fonte não basta. |
| Comparação com existentes | Título/aliases e escolha do alvo pelo modelo. | Registrar candidatas consideradas e motivo para não enriquecer um destino pertinente. |
| Confiança/incerteza | Sem decisão editorial própria. | Admitir `incerto`; não forçar criação para completar uma cota. |
| Mínimo de fontes | Uma fonte pode sustentar uma página. | Manter; não impor duas ou três para todos os neurônios. |
| Mínimo de caracteres/afirmações | Uma afirmação válida pode bastar. | Não usar mínimo numérico como substituto de utilidade. |
| Propostas por trecho | Até três. | Manter como teto inicial, com zero propostas permitido; avaliar excesso por assunto, não só quantidade. |
| Contexto da origem | Trechos de até 8.000 caracteres. | Testar consistência entre trechos e visão do assunto; não inferir conteúdo ainda não lido. |
| Candidatas e índice | Até seis candidatas, 120 entradas e 12 mil caracteres no índice. | Medir perda de destinos pertinentes; não ampliar limites sem demonstrar necessidade. |
| Afirmações | Até 72 acumuladas, com 24 visíveis por candidata. | Preservar limites e garantias de conteúdo não visto; propor revisão de escopo se a página se tornar incoerente. |
| Raízes e ligações | Até dez raízes e oito ligações. | Manter inicialmente; quantidade não garante qualidade nem obriga preencher vagas. |
| Sobreposição semântica | Identidade exata e diagnóstico limitado. | Calibrar comparação com exemplos rotulados; nenhum limiar numérico arbitrário é aprovado aqui. |
| Versão da política | Não há versão editorial separada. | Identificar a política usada em avaliações e propostas, sem reprocessar automaticamente todo o acervo ao mudá-la. |

## 8. Preparar contrato e pontos de implementação

### Contrato de decisão

Preparar tipos e validações para: decisão, origem/trecho/revisão, versão da política, alvo quando aplicável, finalidade da página, tipo de ganho e justificativa curta do destino. Trata-se de justificativa do produto, sem solicitar raciocínio interno do modelo.

Decisão, proposta editorial e publicação validada são estados diferentes. Uma justificativa bem formada não dispensa conferir as evidências e as operações no servidor.

Na futura implementação:

1. **Contrato e exemplos:** especificar decisões e operações em `automacao-tipos.ts` ou módulo editorial próprio.
2. **Geração:** adaptar `gerador.ts` e o schema em `automacao.ts` para decidir o destino antes de compor uma página. Conferir compatibilidade do schema estrito com a documentação oficial do provedor naquele momento.
3. **Validação:** acrescentar critérios de publicação, resultado sem novidade e resultado incerto, preservando as transações existentes.
4. **Recuperação:** verificar se um alvo útil foi encontrado e lido; título semelhante sozinho não autoriza anexar conteúdo.
5. **Edição:** preparar reforço de evidência, correções e estruturas sem duplicação ou perda de referências.
6. **Registro:** decidir onde conservar decisões editoriais úteis para auditoria. Persistência nova exige schema/migração e testes próprios; não adicionar campos de produção neste planejamento.

Validações determinísticas devem barrar violações objetivas, como alvo inexistente, evidência inválida e operação não permitida. Elas não substituem avaliação semântica humana ou transformam uma pontuação do modelo em garantia de utilidade.

## 9. Relações e consolidação dos neurônios existentes

As páginas 3498, 3499 e 3500 são casos de páginas temáticas criadas juntas. Avaliar se ligações entre elas ajudam a navegação. As páginas de Google Ads permitem testar assuntos complementares que devem continuar distintos.

Preparar um relatório com: páginas envolvidas, revisões, relação proposta, escopo de cada página e afirmações/evidências preservadas. Para possível fusão, incluir um destino proposto e o tratamento de referências à página de origem, histórico, edições humanas e conflitos. Nenhuma fusão deve ocorrer apenas para reduzir a contagem de neurônios.

Primeira entrega: sugestões e prévias. A execução de fusões, exclusões ou reorganização em massa é uma funcionalidade posterior, fora do primeiro ajuste de criação/enriquecimento.

## 10. Casos de teste e critérios de avaliação

### Matriz mínima

| Cenário | Resultado esperado a verificar |
| --- | --- |
| Lista curta de ferramentas sem contexto | Pode permanecer na origem; nova página precisa demonstrar ganho. |
| Decisão importante em nota curta, com motivo e consequência | Não ser descartada automaticamente pelo tamanho ou por ter uma fonte. |
| Tarefa concluída sem desenvolvimento adicional | Não promover somente por existir uma frase citável. |
| Conceito reutilizável de uma única fonte | Criação permitida quando utilidade e destino forem adequados. |
| Uma nota com três temas distintos | Separação permitida; não exigir três fontes nem fundir temas diferentes. |
| Duas fontes complementares | Enriquecer ou sintetizar com contribuições identificáveis. |
| Mesmo assunto com título/alias diferente | Considerar o destino existente antes de criar duplicata. |
| Assuntos próximos com funções diferentes | Preservar escopos distintos e relacionar quando útil. |
| Mesma afirmação, nova evidência | Reforçar sustentação sem repetir a proposição como outra afirmação. |
| Repetição da mesma entrada | Nenhuma página/revisão adicional sem mudança efetiva. |
| Correção temporal e divergência entre fontes | Distinguir atualização de incompatibilidade contextual; preservar procedência. |
| Página com afirmações fora das 24 visíveis | Não remover nem declarar revisão completa do que ficou oculto. |
| Nota longa e processamento por trechos | Não duplicar conceitos entre trechos nem declarar cobertura antes de concluir. |
| Mudança somente de ligações/perguntas | Reconhecer alteração útil sem exigir afirmação nova. |
| Página editada, pausada ou renomeada durante a geração | Respeitar proteção e revisão; não repetir escrita para forçar publicação. |
| Citação válida com conclusão não sustentada | Não confundir localização do trecho com sustentação da proposição. |
| Alvo pertinente ausente das candidatas | Registrar falha de recuperação; não atribuir o caso automaticamente à política editorial. |

### Comparação controlada

Preparar um conjunto inicial de aproximadamente 20–30 casos, combinando exemplos reais autorizados e casos sintéticos, incluindo exemplos positivos e negativos. O tamanho é uma proposta de amostra inicial, não uma garantia estatística.

Comparar política atual e candidata com as mesmas entradas, modelo e perguntas. Separar:

- **Criação adequada:** páginas julgadas úteis entre as propostas de criação, com motivo por caso.
- **Publicação redundante:** página nova que apenas repete origem ou destino existente.
- **Enriquecimento adequado:** informação incorporada à página correta sem desviar seu escopo.
- **Cobertura útil:** conceitos e relações relevantes que deveriam aparecer e foram perdidos.
- **Recuperação:** capacidade de responder perguntas de conceito, projeto, comparação, decisão e divergência.
- **Preservação:** evidências, referências, contexto temporal e edições humanas mantidos.

Menos páginas não é critério suficiente de aprovação. Não criar nada também falha se conceitos úteis deixarem de ser recuperáveis. Não afirmar ganho geral com base somente nos 14 neurônios iniciais.

## 11. Sequência de entrega e aceite

| Fase | Entrega | Condição para avançar |
| --- | --- | --- |
| A | Inventário atualizado e fichas individuais. | Todos os itens examinados, fatos separados de interpretação e nenhuma escrita. |
| B | Rubrica, decisões e exemplos rotulados. | Critérios distinguem nota curta útil, resumo redundante e conceito reutilizável. |
| C | Contrato e testes de criação/edição. | Operações e motivos são verificáveis; compatibilidade e proteção de evidências documentadas. |
| D | Implementação em ambiente de teste. | Testes RED/GREEN, revisão independente e regressões de fonte, ID, estrutura e concorrência passando. |
| E | Comparação controlada com a política atual. | Evidências concretas de menos redundância sem perda de recuperação ou proteção. |
| F | Propostas de revisão dos neurônios reais. | Prévia por item com destino e revisões; sem fusão/exclusão automática. |
| G | Ativação futura da política aprovada. | Escopo de execução definido; reversão da política possível sem apagar conhecimento existente. |

Na fase E, usar como exigências de segurança zero alterações de origens, zero perda silenciosa de evidência/referência e zero sobrescrita de edição humana. Qualidade editorial exige revisão por caso; limiares de aprovação quantitativos devem ser definidos com a amostra rotulada antes de avaliar a candidata, não escolhidos depois do resultado.

## 12. Decisões a fechar na revisão

1. Confirmar se o perfil sintético é o candidato inicial.
2. Aprovar os exemplos que distinguem utilidade própria de mera reformulação.
3. Escolher como representar reforço de evidência sem quebrar identidade/referências.
4. Definir o destino de uma decisão editorial incerta e sua condição de reavaliação.
5. Aprovar a amostra e as perguntas usadas para comparar políticas.
6. Definir quais revisões dos neurônios existentes devem chegar primeiro como prévia.

## 13. Briefing para revisão do Claude

> Revise este plano considerando o código e a análise da granularidade do Bimo. O escopo é qualidade dos neurônios e parâmetros de criação/edição. Verifique utilidade própria, ganho sobre a origem, escolha do destino, enriquecimento, reforço de evidência, sobreposição, relações, IDs, preservação de afirmações não vistas e concorrência. Questione regras que apenas reduzam páginas, exijam múltiplas fontes indiscriminadamente ou confundam justificativa do modelo com prova de utilidade. Aponte lacunas, cenários de regressão e ajustes na sequência. Não implemente, altere neurônios, configure automação nem inclua controle de energia nesta revisão.

## 14. Estado desta entrega

Na entrega inicial deste plano não houve novas consultas, gerações ou mudanças de código funcional. A execução posterior foi autorizada separadamente pelo pedido acima e está registrada a seguir.

## 15. Execução — 25/10/2026

| Fase | Resultado executado | Evidência / limite |
| --- | --- | --- |
| A | Inventário atualizado, 14 fichas e prévias individuais. | [Revisão individual](./Bimo%20-%20Revisao%20Individual%20dos%20Neuronios.md). Consulta somente leitura; sem revalidação externa de cada informação. |
| B | Perfil sintético, três critérios e cinco decisões. | Utilidade, ganho e destino suficientes para publicar; zero propostas é resultado válido. Uma origem continua suficiente. |
| C | Contrato versionado e operações de edição. | `editorial.ts`, schemas estritos, `reforcos` e `limparLacunas`. ID lógico preservado ao reforçar; algoritmo original de criação de IDs mantido. |
| D | Implementação com RED/GREEN, revisão independente e persistência local. | Suíte ampla com 1.997 testes/167 arquivos; após ajustes finais, 54 testes focados, TypeScript, ESLint e diff check passaram. Build remoto passou; builds locais encontraram falhas do Next no Windows. |
| E | Comparação real com 24 casos por política e reprodução de buscas. | [Avaliação](./Bimo%20-%20Avaliacao%20da%20Politica%20Editorial.md): v2 atende limiares exploratórios, com duas omissões conhecidas. Sem teste completo do chat nem prova de generalização. |
| F | Propostas para os neurônios reais preparadas. | Prioridade de escopo: 3486, 3489 e 3491. Relações têm prévias por ID; nenhuma fusão/exclusão executada. |
| G | Ativação controlada da política avaliada. | Vercel `dpl_GRnCEg18jz9QMhY3NuM28PF8tSpG`, build READY em aproximadamente 27 segundos, promovido em produção. Sem reprocessamento forçado do acervo. |

### Contratos e parâmetros efetivos

- `politica=sintetica-v2`; `semPublicacao` é nulo quando há propostas, ou contém `conservar_origem`/`adiar`, motivo e condição de reavaliação. O gerador real recusa omissão de versão; compatibilidade sem versão permanece apenas nos callbacks internos de testes.
- Cada proposta registra ação, finalidade/ganho/destino com justificativa e IDs de candidatas consideradas. O servidor verifica critérios e coerência objetiva; isso **não certifica mérito semântico** nem identifica toda paráfrase redundante.
- Enriquecimento/relação exige alvo lido entre candidatas gerenciadas. Só constar do índice não permite edição às cegas. Criar com identidade já conhecida é recusado, sem conversão silenciosa para enriquecimento.
- `reforcos` aceita evidências localizáveis para IDs visíveis, preserva texto/natureza/ID e referências de divergência, não elimina evidências antigas e limita dez evidências por afirmação. Repetir evidência não publica outra revisão. Operação conflitante, ID não visto ou citação inválida é recusada.
- `limparLacunas=true` com lista vazia remove perguntas explicitamente; lista vazia sem esse comando mantém as anteriores. Afirmações fora das 24 visíveis continuam protegidas.
- Proposta inválida não derruba irmãs válidas. Publicação parcial e estado `revisar`, sem avanço do cursor, são atômicos. Quando nada é válido, a origem fica em revisão, sem falsa conclusão.
- Adiamento e conservação registram motivo no Diário privado existente; adiamento também conserva a condição. Logs e `ultimo_erro` guardam apenas categoria segura. Adiamento editorial não recebe repetição automática; nova revisão de conteúdo da origem permite nova avaliação. Corrigir o contexto na origem é o caminho de retomada disponível nesta versão; não foi adicionada tela de triagem.
- Publicações guardam política, decisão e origem/revisão/trecho no JSON de estrutura já existente. **Não foi necessária migração.** Decisões de conservar/adiar usam eventos existentes por dono, sem tabela nova.
- Limites anteriores mantidos: três propostas, trechos de 8.000 caracteres, seis candidatas, índice de 120 entradas/12 mil caracteres, 72 afirmações/24 visíveis, dez raízes e oito ligações. Sem mínimo arbitrário de tamanho, fontes ou afirmações.

### Operação e reversão

O próximo processamento normal usa a nova política; a ativação não solicita nova leitura de todas as notas já concluídas, não reabre impedimentos editoriais e não reescreve os 14 neurônios examinados. Controle de energia, telas e agendamento ficaram fora desta entrega.

Reversão de código: promover a publicação anterior `dpl_9F4Ljq3jC711Stt4QreCijD4TCXh` (`bimo-p74oenhcz-brunoaugustomaciel-6530s-projects.vercel.app`) sem apagar páginas ou evidências. O JSON editorial é opcional para leitura legada; reverter código não desfaz publicações já realizadas nem remove estados de revisão. Não executar a reversão como parte de uma simples conferência.

As duas omissões da amostra (reforço puro e conceito junto de instrução maliciosa) permanecem registradas para nova calibração com exemplos inéditos. A ativação é uma melhoria aferida nesta amostra, não garantia de criação perfeita. Nenhum commit ou push foi realizado nesta execução.
