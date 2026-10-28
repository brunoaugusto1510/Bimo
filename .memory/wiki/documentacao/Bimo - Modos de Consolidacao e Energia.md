# Bimo — propostas de modos de consolidação e energia

Data: 25/10/2026.

Status: brainstorming solicitado pelo usuário. Este documento registra propostas de produto; não indica que os modos foram implementados ou que um novo agendamento foi autorizado.

## Objetivo

Permitir que a pessoa controle quando o Bimo revisa suas notas, quais fontes entram no trabalho e quanto da sua energia pode ser usado na criação e no enriquecimento de neurônios. As notas pessoais continuam preservadas como fontes. Uma leitura pode criar, enriquecer ou concluir sem novidade.

Os modos são combinações de três controles: **quando executar**, **quais notas revisar** e **quanta energia destinar**. Exemplo: revisar diariamente um conjunto escolhido, usando até 20% da energia disponível. O percentual é ilustrativo, não uma configuração aprovada.

## Perfis propostos

| Perfil | Comportamento | Uso principal |
| --- | --- | --- |
| Sob demanda | Executa quando a pessoa pede; considera por padrão notas pendentes ou alteradas. | Controle direto de consumo. |
| Diário | Executa uma revisão por dia no horário escolhido, respeitando o orçamento. | Atualização previsível. |
| Contínuo | Notas estáveis entram automaticamente no processamento após mudanças. | Conexões surgindo ao longo do uso. |
| Notas escolhidas | Revisa notas, pastas ou um conjunto relacionado a um assunto selecionado. | Projeto, estudo ou tema específico. |
| Revisar todo o acervo | Inicia uma tarefa para percorrer a base com progresso persistido. | Primeira organização ou revisão abrangente. |
| Pausado | Suspende processamento e conserva a fila para retomar depois. | Reservar energia ou interromper uma revisão. |

Seleção de notas pode ser combinada com execução manual, diária ou contínua. A seleção é opcional; não se torna requisito para usar a Wiki Viva.

## Duas intenções para a revisão do acervo

- **Colocar o cérebro em dia:** priorizar notas ainda não lidas, alterações e conhecimento desatualizado. Opção padrão sugerida.
- **Procurar novas conexões:** reconsiderar também notas já lidas à luz do conhecimento acumulado desde a última revisão. Pode consumir mais energia; não deve ser disparada silenciosamente como se fosse simples manutenção.

"Revisar tudo de uma vez" significa iniciar uma única tarefa para o acervo, com execução em lotes e retomada. Não significa colocar todas as notas em um único prompt ou concluir sem respeitar limites. A tarefa pode atravessar várias execuções e renovações de energia, conforme a política escolhida.

## Energia e previsibilidade

- Mostrar quantidade de notas elegíveis e estimativa de energia em uma faixa antes de iniciar uma tarefa manual.
- Permitir orçamento próprio para consolidação, preservando energia para conversar com o Bimo.
- Definir previamente o comportamento ao atingir o limite: pausar ou continuar após a próxima renovação.
- Reservar energia antes da análise e ajustar pelo consumo confirmado, sem liberar como zero o custo incerto.
- Pausar e retomar do ponto salvo; não repetir uma revisão já concluída por simples reinício da tarefa.
- Informar notas lidas, neurônios criados/enriquecidos, leituras sem novidade e energia consumida.
- Tornar explícito que a análise pode consumir energia mesmo quando não encontra novidade útil.

## Escopo das fontes escolhidas

Oferecer duas políticas distintas:

1. Usar somente o conjunto selecionado como fonte.
2. Permitir conexões com outras notas acessíveis da base, dentro do orçamento.

Não misturar essas políticas silenciosamente. A pessoa deve entender o que o Bimo poderá consultar e usar como evidência.

## Sequência sugerida

Primeira entrega: sob demanda, diário, seleção de notas, revisão completa e pausa. O contínuo pode vir depois como escolha explícita de maior autonomia.

Em qualquer modo, favorecer o enriquecimento de conhecimento existente quando houver ganho, sem transformar cada nota ou palavra em um neurônio novo. A política de granularidade exige avaliação própria e não deve ser definida apenas pelo número de fontes.

## Decisões ainda abertas

- Perfil inicial de uma conta e orçamento padrão de consolidação.
- Relação da energia da consolidação com o orçamento do chat.
- Critérios e intervalo para procurar novas conexões em notas inalteradas.
- Destino da tarefa quando o limite é atingido e prioridade entre tarefas manuais e automáticas.
- Frequência e infraestrutura do agendamento no servidor.
- Política editorial para criar, enriquecer, relacionar, fundir ou apenas conservar nas fontes.

Telas e composição visual não são definidas neste documento.

Análise relacionada: [Granularidade dos neurônios](./Bimo%20-%20Analise%20de%20Granularidade%20dos%20Neuronios.md). A granularidade é uma decisão editorial independente de frequência, escopo e energia.

## Brainstorm de 27/10/2026: comparação com o LLM Wiki e decisões do usuário

Comparação com o texto do padrão em `.memory/.raw/llm-wiki.md` (resumo em [fonte: LLM Wiki](../fontes/llm-wiki-karpathy.md)); o gist publicado e seus comentários não foram conferidos. O gist tem três laços: ingestão (a fonte chega e é integrada), lint (periódico: contradições, afirmações superadas, órfãs, referências ausentes) e consulta (boas respostas voltam para a wiki). Ele não trata de energia: parte do princípio de que a manutenção custa quase nada. No Bimo o custo é medido, e é onde o app diverge por desenho.

**Leitura dos perfis.** Os seis perfis misturam três eixos, e não são seis modos do mesmo tipo:

- **Quando:** sob demanda, diário, contínuo.
- **O que revisar (escopo):** notas escolhidas, revisar todo o acervo.
- **Estado:** pausado.

As duas intenções da revisão equivalem a laços do gist: "colocar o cérebro em dia" é a ingestão; "procurar novas conexões" é o lint. O contínuo é o mais próximo do espírito do gist (compilar uma vez e manter atualizado). O sob demanda é o mais próximo da letra (uma fonte por vez, acompanhada), mas torna a pessoa o gargalo.

**Estado atual, segundo a documentação (produção não verificada nesta sessão).** O app já se comporta como contínuo, sem escolha da pessoa: estabilidade de 90 segundos, Cron diário às 05:00 UTC, aceleração após atividade, lote de até 25 rodadas e teto de 200 mil tokens por dia UTC. A decisão real é que controle dar sobre algo que já está ligado.

### Decisões do usuário (27/10/2026)

1. **Padrão de uma conta: contínuo.** Notas estáveis entram na ingestão automaticamente, dentro do orçamento diário.
2. **O lint divide o orçamento.** A consolidação por "procurar novas conexões" (lint) usa o mesmo orçamento diário que o chat e a ingestão; o orçamento é o medidor universal de gasto. Não há cota separada.
3. **Autonomia é configuração da pessoa, com padrão de publicação direta.** Duas opções: *publicar direto* (padrão; o neurônio entra na base e a pessoa acompanha pelo Diário) e *propor antes de publicar* (o neurônio preparado fica numa fila de propostos e só entra com aprovação). Motivo: a pessoa precisa controlar o próprio gasto.

### Consequências registradas e ainda não decididas

- "Propor antes de publicar" gasta energia ao gerar a proposta mesmo se a pessoa rejeitar. A configuração deve deixar isso claro.
- A opção exige uma fila de propostos e uma tela de aprovação, que não existem. A interface não foi definida.
- Como o lint divide o orçamento, a ordem de prioridade entre chat, ingestão e lint continua em aberto. Sugestão do brainstorm, não aceita: chat primeiro, depois ingestão de nota alterada, depois arranque do acervo, depois lint.
- Sugestão não aceita para reduzir o custo do lint: disparar a releitura de uma nota já lida só quando surgirem neurônios relacionados novos desde a última leitura, em vez de por calendário.
- Seguem abertos: o orçamento padrão, os critérios e o intervalo do lint, o destino da tarefa ao atingir o limite, a prioridade entre tarefas manuais e automáticas, o agendamento no servidor e a política editorial.
- Nada foi implementado nem alterado no código.
