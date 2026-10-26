# Bimo — análise da granularidade dos neurônios

Data: 25/10/2026. Checkout: `fix/processamento-acervo-wiki`, baseado na `main` com a Wiki Viva integrada.

Escopo: análise do código, leitura de metadados e afirmações publicadas em produção e consulta a fontes primárias de LLM Wiki. Nenhuma nota, neurônio, configuração de geração ou dado de produção foi alterado nesta análise. Não houve inferência paga. As propostas de modos e energia estão em [Modos de consolidação e energia](./Bimo%20-%20Modos%20de%20Consolidacao%20e%20Energia.md).

## Conclusão

Uma única fonte pode sustentar várias páginas de uma LLM Wiki, e uma página pode começar com uma única fonte. Não existe proporção universal de notas por neurônio. A questão editorial é se cada página tem assunto próprio, utilidade para consultas futuras e relações pertinentes com o restante da base.

No Bimo há exemplos justificáveis de extração de conceitos, junto de páginas com pouco ganho sobre anotações muito curtas. A criação atual é permissiva: há validação de evidências, mas não uma política operacional de granularidade que filtre a promoção de um fato isolado a página independente. Isso não torna todos os neurônios de uma fonte inadequados, nem comprova que haverá a mesma distribuição ao processar o acervo restante.

## O que a referência LLM Wiki permite

O texto original apresenta páginas de entidades, conceitos, resumos e sínteses e descreve uma fonte podendo afetar diversas páginas. Afetar inclui atualizar páginas existentes; não significa criar várias páginas novas a cada leitura. A manutenção e a organização são ajustadas ao domínio. [Karpathy — LLM Wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f), consultado em 25/10/2026.

O plugin `GD4AI/obsidian-llm-wiki` documenta granularidade configurável, detecção de duplicatas e fusão com proteção de páginas revisadas. Isso mostra uma decisão configurável de uma implementação, não uma norma obrigatória para o Bimo. O plugin não foi executado nesta análise. [Documentação do projeto](https://github.com/GD4AI/obsidian-llm-wiki#-features), consultada em 25/10/2026.

## Fotografia real da base

Consulta considerando somente a revisão publicada mais recente de cada `nota_id`:

| Indicador | Quantidade |
| --- | ---: |
| Neurônios atuais | 14 |
| Com uma origem | 13 |
| Com duas origens | 1 |
| Com mais de duas origens | 0 |
| Com uma única afirmação | 3 |
| Sem ligações a outros neurônios | 10 |
| Publicações incluindo histórico | 15 |

**Correção de contagem:** o relatório operacional anterior chamou 15 publicações de 15 neurônios. A tabela `paginas_wiki` mantém snapshots por revisão; o total atual de neurônios é 14. As contagens anteriores feitas diretamente com `count(*)` nessa tabela não devem ser usadas como número de neurônios distintos.

"Sem ligações a outros neurônios" não significa desconectado de tudo: as sinapses com as notas de origem continuam existindo. Uma origem compartilhada também não demonstra duplicação sem comparar os conteúdos.

## Exemplos examinados

| Caso real | Evidência observada | Interpretação editorial |
| --- | --- | --- |
| Tecnologias consideradas para o trabalho de graduação, id 3491 | Uma origem de 34 caracteres e uma afirmação listando ferramentas consideradas, sem detalhar seu uso. | Forte candidato a permanecer na nota original ou integrar uma página do projeto; pouco ganho aparente como página própria. |
| Modelo CSV para coleta de dados de empresas, id 3489 | Origem de 196 caracteres; uma afirmação registra conclusão de uma tarefa e verificação do cabeçalho. | Aparência de resumo de tarefa. Precisa justificar por que merece um conceito independente. |
| Correções da API do Portal do Cliente, id 3486 | Origem de 131 caracteres e uma afirmação com duas correções concluídas numa data. | Pode compor histórico do projeto; a página atual tem pouco conteúdo além da origem. |
| Pesquisa Desigualdade, ODS e ética, origem 2582 | Origem com 4.027 caracteres. Gerou páginas sobre desigualdade, governança digital e desenvolvimento sustentável, com três ou quatro afirmações cada. | Separação temática defensável. O problema não é serem três páginas de uma fonte. Faltam relações entre os temas quando sustentadas. |
| Incorporação de relatórios Power BI no sistema, id 3494 | Duas origens e cinco afirmações, reunindo implementação e roteiro de apresentação, com datas e estado das tarefas. | Exemplo de consolidação de fontes complementares. Não comprova sozinho a qualidade de todas as inferências. |
| Google Ads: contas de teste, OAuth2 e token de desenvolvedor | Páginas sobre aspectos diferentes, com algumas ligações entre elas. | Uma página por aspecto pode ser útil. Uma visão geral poderia ajudar a navegação sem exigir fusão de todos os detalhes. |

As avaliações de utilidade acima são julgamento editorial baseado nos conteúdos examinados; as quantidades, tamanhos das origens e relações foram conferidos no banco. Não é uma avaliação completa da qualidade das 389 notas pessoais.

## Por que o código permite esse resultado

1. **Até três propostas por trecho.** `automacao.ts:39` aceita três propostas; `trechoDaOrigem` trabalha com até 8.000 caracteres. O teto é por rodada, não por nota inteira. Uma nota extensa pode originar mais páginas ao longo de seus trechos. [automacao.ts](../src/lib/wiki/automacao.ts)
2. **Uma afirmação sustentada pode bastar.** Em `automacao.ts:260`, o servidor rejeita zero afirmações; em `:278` aplica máximos de raízes e afirmações. Não exige múltiplas fontes nem ganho editorial mínimo. Isso protege a rastreabilidade, mas permite páginas muito pequenas.
3. **O prompt orienta, mas não estabelece critérios suficientes.** `gerador.ts:21–28` pede conceitos úteis, ausência de propostas sem novidade e enriquecimento do que já existe. `:53` orienta evitar mera repetição. Falta uma decisão operacional entre conservar o fato na origem, enriquecer uma página, criar uma seção ou abrir uma página nova. [gerador.ts](../src/lib/wiki/gerador.ts)
4. **Identidade reconhecida não equivale a sobreposição semântica.** `identidadeConhecida`, em `automacao.ts:123`, compara chave normalizada e aliases exatos. O diagnóstico em `observabilidade.ts:44–61` também usa palavras normalizadas dos títulos/aliases. Isso não decide se dois textos de nomes diferentes merecem uma página conjunta. [observabilidade.ts](../src/lib/wiki/observabilidade.ts)
5. **Ligações entre páginas criadas juntas não nascem automaticamente.** `ligacoesDaSintese`, em `automacao.ts:109–110`, aceita destinos já vistos no índice/candidatas. As propostas novas ainda não têm esses ids no contexto. Os neurônios 3498, 3499 e 3500 nasceram da origem 2582 na mesma transação, conforme o Diário, e os três estão sem ligações a outros neurônios. Uma etapa posterior de relacionamento poderia considerar o conjunto criado, sem ligar indiscriminadamente tudo o que compartilha fonte.
6. **A recuperação é limitada e textual.** Até seis candidatas e índice de até 120 entradas, com limite de tamanho, em `recuperacao.ts`. São limites relevantes para escala, mas não foi demonstrado que provocaram os casos desta amostra. [recuperacao.ts](../src/lib/wiki/recuperacao.ts)

## Política recomendada para o Bimo

### Priorizar a decisão editorial

Antes de publicar uma página nova, decidir entre:

1. Conservar somente na origem, quando a nota já é suficiente.
2. Enriquecer um neurônio existente.
3. Relacionar conhecimento existente, quando a novidade é uma conexão.
4. Criar um neurônio, quando há um assunto reutilizável com ganho de organização ou compreensão.

Uma página nova deveria ter pergunta ou assunto identificável, conteúdo sustentado e valor além de reescrever uma anotação curta. Uma única afirmação ou fonte pode ser suficiente em um caso importante; números mínimos rígidos não substituem essa avaliação.

### Diferenciar o que está sendo publicado

- **Conceito reutilizável:** pode começar com uma fonte, com utilidade própria.
- **Síntese entre fontes:** reúne notas independentes e deve mostrar a contribuição de cada uma.
- **Resumo de fonte ou registro de tarefa:** pode continuar associado à origem, sem virar automaticamente um neurônio.

Esses papéis podem orientar o compilador internamente. Não exigem taxonomia nem categorização manual do usuário.

### Oferecer granularidade independente do agendamento

Proposta para avaliação: **sintético**, **equilibrado** e **exploratório**. O perfil sintético seria o candidato a padrão do Bimo, favorecendo menos páginas, mais enriquecimento e promoção criteriosa de conteúdo curto. Exploratório permite páginas mais específicas com consumo visível. Nenhum perfil está implementado ou aprovado por esta análise.

### Consolidar sem apagar automaticamente

Detectar sobreposição de afirmações, fontes e assuntos; sugerir fusão ou reorganização quando útil. Preservar citações, histórico, ids/referências e edições humanas. Reorganização existente exige revisão antes de alterar neurônios reais. Compartilhar uma fonte não é motivo suficiente para fundir.

### Avaliar a utilidade antes de expandir o processamento

Usar uma amostra com nota curta de tarefa, referência técnica, texto de vários temas e fontes complementares. Comparar política atual e sintética nas mesmas entradas, separando energia consumida, páginas publicadas, duplicação, enriquecimento, recuperação em perguntas e avaliação humana. Menos páginas não prova qualidade maior, assim como mais páginas não prova mais conhecimento útil.

## Limites desta entrega

Plano de continuidade: [Qualidade e critérios dos neurônios](./Bimo%20-%20Plano%20de%20Qualidade%20e%20Criterios%20dos%20Neuronios.md), restrito à análise e aos parâmetros de criação/edição, sem controle de energia.

Foram criados documentos e feitas leituras. Não houve alteração do gerador, bloqueio/exclusão/fusão de neurônios, configuração de agendamento, migração, commit ou push. O agendamento frequente no Supabase continua uma decisão separada, sem autorização recebida nesta análise.
