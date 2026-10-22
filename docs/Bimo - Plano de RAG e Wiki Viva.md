# Bimo — Plano funcional da Wiki Viva integrada ao agente

Plano original: 21/10/2026. Revisão de escopo: 22/10/2026.

Estado: **planejamento para revisão pelo Claude**. Este documento substitui as decisões anteriores que tornavam uma tela separada e a seleção manual de notas o caminho principal da wiki. O código experimental permanece no checkout; sua existência não representa aprovação desse fluxo.

**Implementação posterior, autorizada em 22/10/2026:** backend e agente integrados foram implementados na mesma branch, com fila, descoberta, evidências, orçamento e executor independente. Consulte [funcionamento, operação e limites](./Bimo%20-%20Wiki%20Viva%20-%20Operacao.md). Os parágrafos sobre entrega apenas documental abaixo registram a etapa de planejamento que antecedeu essa autorização; não descrevem o estado atual do código. Ativação no banco e piloto com modelo real continuam separados.

Branch de trabalho: feat/estrutura-llmwiki.

## 1. Decisão de produto e limite desta entrega

O Bimo deve acumular, conectar e desenvolver o conhecimento registrado pelo usuário. A pessoa anota livremente; o sistema adapta sua organização ao conteúdo da base, sem impor assunto, formato ou taxonomia.

A Wiki Viva é uma camada persistente de conhecimento do agente. O Bimo identifica conceitos, encontra conexões, cria notas derivadas, enriquece sínteses existentes e reutiliza esse conhecimento nas conversas. Essas notas pertencem à mesma base das anotações pessoais.

O usuário não precisa abrir uma área separada, selecionar um lote de notas, inventar um título de síntese ou executar uma compilação a cada alteração. O processamento integra o ciclo de vida das notas e o trabalho do agente.

**Esta entrega altera somente planejamento e registro de decisões.** Telas, navegação, componentes, botões, disposição visual e apresentação de evidências serão definidos pelo usuário com o Claude. O plano estabelece dados e comportamentos que esses trabalhos poderão consumir, sem prescrever design.

O documento não autoriza aplicar migrações, processar dados reais, chamar modelos pagos, habilitar automação ou fazer commit/push. Essas execuções continuam separadas da revisão funcional.

## 2. Resultado esperado

Exemplo de evolução:

1. O usuário registra uma experiência sobre cache, uma anotação sobre edição simultânea e uma dúvida sobre sincronização offline.
2. O Bimo identifica o tema comum e procura conhecimento existente sobre consistência entre cópias.
3. Se encontrar uma nota derivada adequada, amplia essa nota. Caso contrário, pode criar uma síntese com identidade própria e referências às anotações que a sustentam.
4. Uma nova anotação sobre sistemas distribuídos acrescenta outra perspectiva. A síntese evolui, preservando o que continua válido e registrando divergências.
5. Em uma conversa futura, o agente encontra a síntese e consulta suas evidências para responder. A conexão construída anteriormente permanece disponível.

O mesmo ciclo atende registros pessoais, receitas, projetos, estudo, listas, código, relatos e textos incompletos. Nenhum formato exige classificação prévia pelo usuário.

Sucesso significa melhor compreensão, conexões úteis e respostas fundamentadas. Quantidade de notas e de ligações não são medidas suficientes de qualidade.

## 3. Escopo funcional inicial

Incluído no primeiro ciclo completo:

- Reconhecer alterações relevantes nas notas e no conhecimento importado já representado na base.
- Processar a base preexistente de forma gradual e retomável.
- Descobrir conceitos e temas sem taxonomia fixa.
- Encontrar conhecimento relacionado por índice, busca textual, aliases e ligações.
- Decidir entre criar uma nota derivada, enriquecer uma existente, registrar divergência ou não alterar nada.
- Guardar evidências, revisões de origem, autoria e dependências de cada publicação.
- Atualizar o conhecimento afetado por novas anotações, correções e remoções.
- Integrar consulta às sínteses e expansão até os originais à conversa normal com o agente.
- Preservar anotações pessoais e edições manuais de notas derivadas.
- Controlar consumo, repetição, concorrência e falhas antes de habilitar processamento contínuo.

Fora do primeiro ciclo: embeddings, banco vetorial, File Search hospedado, reranking com outro modelo, fine-tuning, pesquisa externa automática, novos extratores, OCR, áudio/transcrição e mescla/exclusão/reescrita automática de notas pessoais. Telas e design também ficam fora deste planejamento.

A memória está na base do Bimo, não nos pesos do modelo. Busca vetorial é uma possível melhoria futura, condicionada a erros de recuperação medidos. Não bloqueia a entrega da Wiki Viva.

## 4. Base existente e reaproveitamento

As referências abaixo descrevem o checkout local; não comprovam o estado do banco remoto. Revalidar os contratos antes de cada implementação.

| Base existente | Uso no plano |
| --- | --- |
| RepositorioDeNotas e adaptadores banco/memória | Identidade, leitura e escrita; preservar contratos e testabilidade |
| Busca textual em português no Postgres | Recuperação inicial; o mecanismo usa ts_rank, sem pressupor BM25 |
| Revisão da nota e histórico do editor | Concorrência otimista; não presumir snapshot histórico imutável em cada autosave |
| Índice de ligações | Wikilinks derivados do texto, sem duplicação na tabela relacoes |
| Fontes, entidades, relações e proveniência | Preservar origens e identidades; ampliar somente o necessário para evidências e dependências |
| Responses API no agente | Consulta por ferramentas e produção de propostas estruturadas |
| Plano de login multiusuário | Contexto do dono acompanha cada operação até o armazenamento |

Documentos relacionados: [Visão e Direção](./Bimo%20-%20Vis%C3%A3o%20e%20Dire%C3%A7%C3%A3o%20do%20Projeto.md), [Retrieval](./Bimo%20-%20Retrieval%20%28Fase%204%29.md), [Sources & Ingestion](./Bimo%20-%20Sources%20%26%20Ingestion%20%28Fase%203%29.md), [Architecture Audit](./Bimo%20-%20Architecture%20Audit.md) e [Login Multiusuario](./Bimo%20-%20Plano%20de%20Login%20Multiusuario.md).

Há uma divergência histórica sobre wikilinks no Architecture Audit. A regra atual de CLAUDE.md e do código prevalece: as ligações do texto não são espelhadas em relacoes.

## 5. Conceitos e invariantes

**Anotação pessoal:** conteúdo do usuário ou importado para seu acervo. Pode estar incompleto, expressar uma hipótese ou opinião e usar qualquer organização. O compilador preserva autoria e contexto.

**Nota derivada:** nota real da mesma base, criada ou mantida pelo Bimo. Possui identidade opaca, conteúdo, revisões e referências. Seu papel é identificado por metadados de domínio, não por pasta, tag, nome ou trecho de texto falsificável. Uma pasta chamada Wiki não é requisito.

**Afirmação e evidência:** cada afirmação substantiva aponta para material localizável em revisões específicas das anotações/fontes originais. Distinguir informação explícita, inferência, hipótese, opinião, divergência e informação superada. Citação literal prova que um trecho existe; não prova que a conclusão decorre dele. Confiança declarada pelo modelo não é probabilidade calibrada.

**Dependência:** vínculo que identifica quais entradas e revisões sustentam uma publicação. Permite verificar atualidade e impacto sem reler toda a base em cada conversa.

**Raiz independente:** anotação pessoal ou fonte original que sustenta o conhecimento. Notas derivadas podem orientar e compor sínteses mais abrangentes, desde que a cadeia continue chegando às raízes autorizadas. Repetição de uma afirmação em várias sínteses não cria fontes independentes.

## 6. Ciclo funcional integrado

### 6.1 Registrar e agrupar alterações

Criar, alterar, importar, renomear ou remover conteúdo produz um evento de conhecimento na mesma transação da operação correspondente. O evento contém identidades, revisões e tipo da alteração, sem precisar duplicar o texto completo.

O salvamento não espera uma chamada ao modelo. Autosaves próximos são agrupados e o trabalho considera a revisão mais recente. Janela de estabilidade e encerramento de sessão de edição podem orientar o disparo; valores exatos serão definidos por medição.

Conteúdo vazio ou sem mudança relevante pode encerrar o trabalho sem inferência. Alterar organização não exige reescrever conhecimento, embora referências e rótulos possam precisar de atualização.

### 6.2 Capturar entradas

Capturar snapshots imutáveis das entradas, separados das versões reaproveitadas pelo autosave. Guardar texto exato, identidade da origem, revisão/hash e localização das evidências.

Textos grandes são divididos respeitando seções e estruturas. Registrar o que foi processado e o que continua pendente, sem truncar silenciosamente o restante. Não apresentar caracteres como tokens.

### 6.3 Descobrir conhecimento

Uma extração estruturada identifica conceitos candidatos, aliases, afirmações, questões abertas e possíveis relações. Categorias são livres e emergentes; o usuário não escolhe um tipo antes de anotar.

Considerar contexto: a mesma palavra pode designar conceitos diferentes; experiência pessoal não vira regra universal; hipótese não é promovida a fato.

### 6.4 Encontrar conhecimento relacionado

Consultar índice de notas derivadas, aliases, busca textual e ligações resolvidas. Usar termos extraídos da anotação e seu contexto, com variações limitadas e observáveis quando necessário. A recuperação não depende de vetores.

Limitar candidatos, profundidade e tokens. Preservar diversidade de fontes e evidências de divergência. Associação incerta pode resultar em nota distinta ou decisão adiada; não mesclar homônimos por semelhança do título.

O índice é uma estrutura interna de navegação do agente. Não exige uma tela nem uma nota enorme contendo todo o acervo em cada chamada.

### 6.5 Decidir o que persistir

| Resultado | Quando é adequado |
| --- | --- |
| Nenhuma mudança | Repetição, ausência de novidade ou sustentação insuficiente |
| Criar nota derivada | Conceito ou síntese útil com identidade própria e evidências |
| Enriquecer nota existente | Conhecimento novo complementa uma síntese adequada |
| Registrar divergência | Fontes sustentam perspectivas incompatíveis ou contextos diferentes |
| Sugerir relação | Conexão justificável sem necessidade de nova nota narrativa |
| Aguardar revisão | Ambiguidade, edição manual ou operação de maior impacto |

Uma anotação pode gerar nenhuma, uma ou mais propostas, dentro de limites de crescimento e consumo. Não criar uma página para cada substantivo. Duas fontes não são requisito rígido: uma anotação pode sustentar conhecimento útil.

### 6.6 Sintetizar e validar

O compilador recebe entradas autorizadas e contexto relacionado e produz uma proposta estruturada. Não grava no banco diretamente.

O servidor verifica schema, identidades, citações, localização, origem, revisão, gerenciamento, relações permitidas, independência das evidências e ausência de ciclos. Sugestões de título e organização não autorizam alterar identidade ou propriedade das notas.

Cada proposta informa suas entradas e o resultado esperado. Nenhuma mudança é um resultado válido, sem nota vazia. Saída inválida, recusa, incompletude ou falha do modelo impede publicação.

### 6.7 Publicar atomicamente

Após gerar, uma transação curta revalida todas as entradas e a revisão-base da nota alvo. Confere posse do trabalho, geração desejada e proteção das edições manuais.

Nota, histórico, afirmações, evidências e dependências são gravados juntos. Falha cancela o conjunto. Conclusão com entradas superadas não substitui uma versão recente. A chamada externa ocorre fora da transação.

### 6.8 Evoluir continuamente

Nova informação útil pode enriquecer uma síntese ou motivar outra mais abrangente. Dependentes são reavaliados em ondas limitadas. Mudanças em hashes, afirmações ou evidências independentes precisam justificar propagação; publicar texto derivado não inicia ciclos infinitos.

Conexões entre áreas diferentes exigem justificativa e identificação de inferência. Avaliar essa capacidade com exemplos de conhecimento transversal, além de resumos individuais.

## 7. Processar a base preexistente

O ciclo alcança notas novas e anteriores à ativação:

1. Registrar documentos elegíveis de cada dono e suas revisões.
2. Percorrer a base por cursor, em lotes limitados, com progresso durável.
3. Alimentar o mesmo processamento incremental das alterações novas.
4. Retomar após falha sem duplicar conhecimento publicado.
5. Detectar alterações durante a varredura e reprocessar entradas necessárias.
6. Manter cobertura conhecida: elegíveis, processados, pendentes e impedidos por erro/orçamento.

A organização emerge gradualmente. O conhecimento válido já pode ser consultado enquanto o restante é processado. Resposta global só afirma a cobertura efetivamente examinada; dados fora do acesso não entram nem nos totais.

O disparo inicial depende de habilitação operacional e orçamento definidos, sem tornar seleção manual de notas um requisito. A interação dessa habilitação será definida separadamente com o Claude.

## 8. Consultar pela conversa normal

| Necessidade | Comportamento esperado |
| --- | --- |
| Localizar uma anotação | Buscar título, conteúdo e aliases e ler o resultado adequado |
| Explicar um assunto estudado | Recuperar síntese válida e evidências originais |
| Relacionar assuntos | Explorar conceitos, notas e ligações, identificando inferências |
| Comparar perspectivas | Trazer divergências com contexto e revisões |
| Entender mudança temporal | Distinguir revisões e contexto, sem assumir que o mais recente é mais correto |
| Obter panorama | Consultar sínteses temáticas e informar cobertura efetiva |
| Contar ou agregar | Calcular no servidor, sem estimar a partir de amostras do modelo |
| Responder sem evidência | Indicar a lacuna e não atribuir à base informação ausente |

Reaproveitar ferramentas existentes quando forem suficientes. Acrescentar busca de conhecimento, leitura de evidência e exploração de relações conforme necessidade demonstrada. O modelo recebe referências do servidor, sem SQL livre ou escolha de dono.

O pacote de contexto deve ser útil dentro do limite do agente. Evitar consumir todas as voltas com leituras isoladas agrupáveis. Investigações longas podem se tornar trabalhos persistentes em etapa posterior.

Referências finais devem resolver para material autorizado e informar a revisão usada. A apresentação e abertura dessas referências serão definidas com o Claude. Respostas do chat não viram fatos automaticamente; conhecimento adicional fornecido pelo usuário segue o fluxo de registro apropriado e as mesmas regras de evidência.

## 9. Corrigir, proteger e remover conhecimento

- Alteração em origem torna pendente o conhecimento dependente. Até revalidar, uma síntese não pode ser tratada sozinha como evidência atual suficiente.
- Edição manual protege o conteúdo alterado. O domínio permite retirar uma nota do gerenciamento ou retomar processamento por decisão explícita, sem prescrever interface.
- Movimento e renomeação preservam identidade. Distinguir organização de mudança semântica evita bloqueios editoriais desnecessários.
- Correção e restauração criam novas revisões, preservando o histórico aplicável.
- Remoção/perda de acesso impede uso imediato da origem e invalida dependentes. Síntese sem raízes permitidas fica fora das respostas atuais.
- Exclusão alcança snapshots e derivados conforme a política de dados; histórico não justifica manter indefinidamente conteúdo que deveria ser apagado.
- Mesclar conceitos, excluir notas pessoais ou substituir conhecimento consolidado exige política explícita de revisão, fora da autonomia inicial.

## 10. Executar com durabilidade e orçamento

### 10.1 Eventos e trabalhos

A atualização integrada exige processamento fora da duração de uma conversa ou salvamento. Usar outbox transacional e trabalhos persistentes, deduplicados por dono, tarefa/alvo, geração e versão do pipeline.

Reivindicar trabalhos com posse temporária e token de posse. Consumidor que perdeu a posse não publica após outro. Alteração nova avança a geração desejada; resultado antigo fica superado e o trabalho atual permanece elegível.

Retentativas têm limite e espera. Falha de autenticação/configuração interrompe aquela integração até resolução, sem repetição contínua. Não depender de promessa abandonada, temporizador de requisição ou sessão do navegador. Escolher runner e hospedagem antes da ativação.

Reconciliação paginada detecta eventos não consumidos, posse expirada, notas não processadas e dependências inválidas. Execução é pelo menos uma vez, com idempotência persistente na publicação.

### 10.2 Consumo antes de automação

Definir limites por usuário/período, trabalho, documento e onda. Reservar consumo atomicamente antes da chamada; reserva recusada impede execução. Distinguir consumo confirmado, reservado e incerto.

Timeout pode ocorrer após o provedor executar. Não estornar toda a reserva como zero nem prometer uma única cobrança externa; registrar correlação e reconciliar incerteza.

Separar orçamento de consulta e manutenção. Falta de crédito pausa manutenção e preserva salvamento/leitura. Um limitador de frequência em memória não é proteção financeira suficiente para automação.

Começar com limites conservadores configurados e avaliados no piloto. Não promover automaticamente os limites arbitrários do protótipo manual a requisitos do fluxo integrado. Batch e cache são otimizações posteriores à medição.

## 11. Dados e contratos

O modelo físico será revisado antes da implementação. Esta lista define responsabilidades lógicas, sem fixar prematuramente o número de tabelas.

| Responsabilidade | Dados e garantias |
| --- | --- |
| Identidade e gerenciamento | Nota derivada ligada à nota real, dono, gerenciamento e revisão publicada |
| Snapshots e evidências | Texto imutável, origem, revisão/hash, localização, citação e suporte/contraponto |
| Afirmações e relações | Conteúdo explícito/inferido, justificativa, evidências e situação editorial |
| Dependências e índice | Entradas, raízes independentes, termos/aliases, ligações, cobertura e atualidade |
| Eventos e trabalhos | Outbox, gerações, deduplicação, posse, tentativas e resultado |
| Execução e consumo | Modelos, versões de prompt/schema/pipeline, correlação, tokens e reservas |

Toda responsabilidade carrega o dono. Constraints e validações transacionais impedem associação indevida entre usuários. A conexão privilegiada exige filtros explícitos; RLS é defesa adicional.

Portas funcionais: recuperação, geração de propostas, publicação atômica, fila e consumo. Compartilhar regras de RepositorioDeNotas, sem um segundo CRUD divergente. Testar o compilador com provedores simulados e repositório em memória.

Resultados informam estado, documentos/revisões examinados, propostas aceitas/recusadas, notas afetadas, pendências e consumo. Não definem rota de página, layout, botão ou notificação.

## 12. Papel da OpenAI

As referências oficiais foram consultadas no planejamento/protótipo em 21–22/10/2026. Esta revisão de escopo não verifica novamente suporte, preços ou schemas. Revalidá-los antes da implementação correspondente.

- [Responses e function calling](https://developers.openai.com/api/docs/guides/function-calling): operações controladas pelo servidor.
- [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs): extração/propostas estruturadas, com validação adicional de domínio.
- [Reasoning models](https://developers.openai.com/api/docs/guides/reasoning): continuação do laço de ferramentas quando aplicável.
- [Data controls](https://developers.openai.com/api/docs/guides/your-data): retenção por endpoint; store false não é garantia geral de retenção zero.
- [Evaluation best practices](https://developers.openai.com/api/docs/guides/evaluation-best-practices): avaliação por tarefa e julgamento humano.

Reaproveitar o transporte da Responses API com configuração por tarefa. Notas e sínteses são dados não confiáveis, separados das instruções privilegiadas. IDs, revisões, permissões e gravação permanecem sob controle do Bimo.

Chat e compilação podem ter configurações independentes de modelo. Manter a configuração existente como candidata inicial e avaliar antes de substituí-la. Nenhum modelo novo ou preço é fixado nesta revisão.

[Embeddings](https://developers.openai.com/api/docs/guides/embeddings), [Retrieval](https://developers.openai.com/api/docs/guides/retrieval) e [File Search](https://developers.openai.com/api/docs/guides/tools-file-search) são referências de evolução, sem dependência na primeira entrega integrada. Background mode do provedor não substitui a fila e a publicação durável do Bimo.

## 13. Segurança e privacidade

- Conteúdo das notas/fontes/sínteses não habilita ferramentas, altera políticas ou autoriza acesso.
- O compilador só lê entradas permitidas e propõe escrita gerenciada. Sem SQL livre, shell, credenciais ou acesso irrestrito a serviços.
- Revalidar acesso ao recuperar, iniciar trabalho, montar contexto e publicar. Exclusão de conta ou mudança de acesso alcança trabalhos pendentes.
- Isolar buscas, caches, aliases, snapshots, dependências, trabalhos, exportações e métricas por dono. Conteúdo igual não autoriza compartilhar memória privada.
- Logs registram metadados, sem notas, citações, prompts, chave ou corpo de erro do provedor.
- Schema válido não comprova verdade ou autorização. O publicador pode recusar a proposta.
- Exportação preserva conhecimento e proveniência em formatos abertos, sem dependência exclusiva de IDs do provedor.

## 14. Sequência de implementação

| Etapa | Entrega funcional | Condição para avançar |
| --- | --- | --- |
| P0 — Reconciliar o protótipo | Separar backend reaproveitável do fluxo manual não aprovado; fechar contratos e exemplos | Sem dependência de página separada, seleção manual ou embeddings |
| P1 — Evidências e índice textual | Snapshots, gerenciamento, referências e recuperação textual/por ligações | Evidências localizáveis/autorizadas e identidade preservada |
| P2 — Eventos, consumo e durabilidade | Outbox, agrupamento, fila, posse, orçamento e reconciliação | Alterações não se perdem; repetição não duplica; teto impede chamadas |
| P3 — Descoberta e decisão editorial | Conceitos livres, recuperação relacionada e propostas | Conexões transversais úteis; nenhuma mudança sem ganho |
| P4 — Publicação incremental | Atomicidade, proteção de edições, invalidação e propagação limitada | Nova anotação enriquece conhecimento; trabalho antigo não sobrescreve atual |
| P5 — Conversa e base anterior | Agente consulta sínteses/originais; carga inicial paginada | Conversa usa memória acumulada; cobertura e retomada verificáveis |
| P6 — Piloto e avaliação | Corpus aprovado, qualidade, custo, limites e reversão | Ganho demonstrado dentro do orçamento e lacunas documentadas |

P1/P2 podem ser preparados independentemente em contratos; automação exige ambos. P3 começa com simuladores e propostas sem publicação automática. P4 só é ativada após limites e testes de persistência. P5 usa o mesmo ciclo para base existente e alterações novas.

Cada etapa começa com testes e termina com verificação focada. Migrações e integrações reais recebem validação própria antes de ativação. Interfaces podem ser definidas separadamente com o Claude a partir dos contratos funcionais.

## 15. Aceitação e avaliação

1. Anotar não exige abrir outra área, escolher tema ou selecionar origens para compilação.
2. Salvamento termina mesmo com modelo indisponível; trabalho posterior permanece recuperável.
3. Autosaves próximos produzem processamento consolidado da revisão adequada.
4. Registros heterogêneos originam conceitos e conexões sem taxonomia imposta.
5. Novidade enriquece a nota adequada, preservando identidade e evidências válidas.
6. Repetição produz nenhuma mudança ou resultado idempotente, sem duplicatas.
7. Sínteses com a mesma raiz não contam como fontes independentes.
8. Hipóteses, opiniões, divergências e contexto temporal são preservados.
9. Edição manual e concorrência impedem substituição indevida.
10. Remoção/perda de acesso retira evidências atuais e invalida derivados.
11. O agente usa conhecimento acumulado e chega às origens pela conversa normal.
12. A base anterior é processada gradualmente com cobertura e retomada.
13. Orçamento, profundidade e ondas impedem trabalho/custo ilimitados.
14. Esses comportamentos podem ser comprovados sem decisões de telas/design.

Testes determinísticos incluem dois usuários, snapshots imutáveis, Unicode/localização, schema inválido, recusa, citações fabricadas, concorrência, falha na publicação, posse expirada, idempotência e consumo incerto.

Comparar busca textual atual com busca textual + Wiki Viva usando as mesmas perguntas, entradas e orçamento de contexto. Incluir localização, explicação, conexão, divergência, panorama e perguntas sem resposta. Vetores entram em comparação futura somente se os erros de recuperação justificarem.

Medir síntese, recuperação de evidências, sustentação, atualidade, duplicação, cobertura, latência e custo por alteração/pergunta. Não atribuir à memória ganho causado apenas por mais tokens ou outro modelo. Calibrar avaliadores automáticos com revisão humana.

Separar testes offline, integração SQL, provedor real controlado e avaliação funcional de ponta a ponta. Mocks não comprovam qualidade do modelo, locks, rollback ou políticas SQL. Os 168 testes do protótipo manual são evidência histórica daquele recorte, não aprovação nem validação deste fluxo integrado.

## 16. Destino do código experimental

O checkout contém página separada, componente de interface, API manual, metadados de publicação e testes. A migração 0007_wiki_viva foi preparada e não foi aplicada durante aquela implementação.

O fluxo manual foi uma decisão do assistente e não corresponde ao caminho principal solicitado. Seleção de notas, pasta fixa, bloqueio editorial por qualquer revisão e limites por requisição não são requisitos aprovados do produto integrado.

Backend potencialmente reaproveitável: saída estruturada, validação de citações, snapshots e proteção/publicação transacional. Faltam descoberta, eventos, processamento durável, consumo persistente e evolução integrada.

Esta tarefa não remove, adapta nem habilita aquele código. Telas existentes serão tratadas com o usuário e o Claude. Reavaliar também a migração à luz dos contratos antes de executá-la.

## 17. Briefing para o Claude

> Revise o planejamento funcional da Wiki Viva integrada ao agente Bimo. O usuário anota livremente; o sistema descobre conexões, cria e enriquece notas derivadas na mesma base e usa esse conhecimento nas conversas. A wiki não depende de área separada nem seleção manual de origens. A primeira entrega usa índice, busca textual e ligações; embeddings são posteriores e opcionais. Leia contratos e código, distinguindo protótipo de requisito aprovado. Avalie evidências, raízes independentes, descoberta, atualização, concorrência, fila, custo e base anterior. Entregue achados com cenário, impacto, correção e ajustes de sequência. Nesta revisão funcional, não implemente, aplique migrações ou chame serviços externos. Telas e design serão tratados diretamente com o usuário em trabalho separado.
