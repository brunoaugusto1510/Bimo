# MemWiki do Bimo

Diretório central do conhecimento de desenvolvimento. Leia `hot.md` primeiro; use as páginas abaixo para aprofundar o domínio da tarefa.

- [Contexto inicial](hot.md): estado observado e próximos passos.
- [Histórico de trabalho](log.md): registros de sessões, preservados cronologicamente.
- [Stack](stack.md): tecnologias, versões, estrutura e comandos.
- [Padrões](patterns.md): contratos e convenções existentes.
- [Problemas e limites](bugs.md): divergências verificadas e pontos que exigem validação.
- [Decisões](decisions.md): escolhas de arquitetura e organização da memória.

## Conhecimento sintetizado por domínio

- [Notas e autenticação](dominios/notas-e-autenticacao.md): identidade, persistência, concorrência, sessão e autorização.
- [Agente e ingestão](dominios/agente-e-ingestao.md): chat, ferramentas, rascunho e fontes.
- [Wiki Viva](dominios/wiki-viva.md): política editorial, fila, lotes, evidências, recuperação e observabilidade.
- [Interface e grafo](dominios/interface-e-grafo.md): árvore estável, editor, autosave, simulação e design.
- [Mobile](dominios/mobile.md): Expo, serviços simulados, estado e testes separados.
- [Plano do sistema de memória do aplicativo](documentacao/Bimo%20-%20Plano%20do%20Sistema%20de%20Memoria.md): proposta de 27/10; conversas persistentes, preferências, decisões, pendências, recuperação, esquecimento, orçamento, fases F0–F8 e 30 critérios de aceite. Não implementado; distinto desta MemWiki.

## Fontes brutas ingeridas

Resumos das fontes em `.memory/.raw/` (imutáveis; a página resume e confronta, o arquivo bruto é a fonte da verdade).

- [LLM Wiki — texto do padrão](fontes/llm-wiki-karpathy.md): ingerida em 27/10/2026; confere a referência de 23/10 e a auditoria de 26/10, e lista o que a fonte traz além delas.

## Verificações da memória

- [Lixeira com restauração — 30/10/2026](verificacoes/2026-10-30-lixeira.md): implementação web, isolamento, autosave, restauração de evidências e migração 0013 validada localmente, ainda não aplicada ao banco real.

- [Consolidação de blockchain/economia — 30/10/2026](verificacoes/2026-10-30-consolidacao-blockchain-economia.md): seis temas enriquecidos no banco real, duplicata preservada como redirecionamento, 50 citações conferidas e prevenção de duplicatas validada localmente; sem deploy.
- [Neurônios de blockchain/economia vs LLM Wiki — 30/10/2026](verificacoes/2026-10-30-neuronios-blockchain-economia.md): sete páginas reais, fontes e citações conferidas; duplicata de mercados, síntese superficial e relações a melhorar. Sem alteração no aplicativo ou banco.
- [Ingestão e lint — 26/10/2026](verificacoes/2026-10-26-ingest-lint.md): escopo, achados, correções e limites de evidência.
- [Busca do chat por assuntos — 29/10/2026](verificacoes/2026-10-29-busca-do-chat.tdd.md): implementação, evidência RED/GREEN, 137 testes offline e limites de validação.

## Documentação migrada — 26/10/2026

Os 25 documentos de `docs/` foram incorporados integralmente a `documentacao/`, com nomes e subpastas preservados. Novas atualizações devem ocorrer nesses caminhos. Planos, propostas e relatórios continuam com seu contexto e sua data; a migração não os converte em funcionalidades implementadas ou verificadas hoje.

### Visão, arquitetura e base de notas

- [Visão e direção do projeto](documentacao/Bimo%20-%20Vis%C3%A3o%20e%20Dire%C3%A7%C3%A3o%20do%20Projeto.md): objetivos e princípios do Bimo.
- [Auditoria de arquitetura](documentacao/Bimo%20-%20Architecture%20Audit.md): decisões conceituais da Fase 1.
- [Núcleo de conhecimento — Fase 2](documentacao/Bimo%20-%20Knowledge%20Core%20%28Fase%202%29.md): modelo e infraestrutura de conhecimento.
- [Fontes e ingestão — Fase 3](documentacao/Bimo%20-%20Sources%20%26%20Ingestion%20%28Fase%203%29.md): fontes, extração e proveniência.
- [Recuperação — Fase 4](documentacao/Bimo%20-%20Retrieval%20%28Fase%204%29.md): busca e recuperação.
- [Plano de notas no banco](documentacao/Bimo%20-%20Plano%20de%20Notas%20no%20Banco.md): histórico de implementação, decisões e validações.
- [Plano de login multiusuário](documentacao/Bimo%20-%20Plano%20de%20Login%20Multiusuario.md): planejamento de contas e autenticação.
- [Plano do Grafo Vivo](documentacao/Bimo%20-%20Plano%20do%20Grafo%20Vivo.md): integração visual do grafo e do agente.

### Wiki Viva — funcionamento e evolução

- [Entrega consolidada — 26/10/2026](documentacao/Bimo%20-%20Entrega%20Consolidada%20da%20Wiki%20Viva%20-%202026-10-26.md): síntese da entrega e evidências.
- [Wiki Viva — operação](documentacao/Bimo%20-%20Wiki%20Viva%20-%20Operacao.md): funcionamento, configuração, operação e limites.
- [Wiki Viva — pendências](documentacao/Bimo%20-%20Wiki%20Viva%20-%20Pendencias.md): capacidades entregues e trabalho restante.
- [Plano de RAG e Wiki Viva](documentacao/Bimo%20-%20Plano%20de%20RAG%20e%20Wiki%20Viva.md): planejamento funcional e seu histórico.
- [LLM Wiki e referência no Obsidian](documentacao/Bimo%20-%20LLM%20Wiki%20-%20Funcionamento%20e%20Referencias%20Obsidian.md): pesquisa de 23/10 e matriz inicial para comparação.
- [Plano de qualidade e critérios dos neurônios](documentacao/Bimo%20-%20Plano%20de%20Qualidade%20e%20Criterios%20dos%20Neuronios.md): critérios editoriais e avaliação.
- [Análise da granularidade dos neurônios](documentacao/Bimo%20-%20Analise%20de%20Granularidade%20dos%20Neuronios.md): análise de utilidade, assunto e fontes.
- [Modos de consolidação e energia](documentacao/Bimo%20-%20Modos%20de%20Consolidacao%20e%20Energia.md): propostas de produto e, desde 27/10, as decisões do usuário (padrão contínuo, orçamento único, autonomia configurável); nada implementado.
- [Desenho: tensão entre neurônios — 27/10/2026](documentacao/Bimo%20-%20Desenho%20da%20Tensao%20entre%20Neuronios.md): proposta para a lacuna 8 (contradição entre neurônios diferentes), com armazenamento, validação, leitura, testes e o que fica fora; não implementada.

### Wiki Viva — avaliações e ensaios datados

- [Revisão individual dos neurônios](documentacao/Bimo%20-%20Revisao%20Individual%20dos%20Neuronios.md): inventário e recomendações de 25/10.
- [Avaliação da política editorial](documentacao/Bimo%20-%20Avaliacao%20da%20Politica%20Editorial.md): protocolo e resultados de avaliação.
- [Ensaio real — 25/10/2026](documentacao/Bimo%20-%20Ensaio%20Real%20dos%20Neuronios%20-%202026-10-25.md): primeira passagem documentada.
- [Segunda passagem — 26/10/2026](documentacao/Bimo%20-%20Segunda%20Passagem%20dos%20Neuronios%20-%202026-10-26.md): ajustes e resultados posteriores.
- [Correções e terceira passagem — 26/10/2026](documentacao/Bimo%20-%20Correcoes%20e%20Terceira%20Passagem%20-%202026-10-26.md): correções editoriais e novo ensaio.
- [Revisão geral da Wiki Viva — 26/10/2026](documentacao/Bimo%20-%20Revisao%20Geral%20da%20Wiki%20Viva%20-%202026-10-26.md): quatro revisões, teste de jornada, correções do commit `87b6da8`, ordem de deploy da migração 0011 e achados abertos.
- [Auditoria da estrutura vs LLM Wiki — 26/10/2026](documentacao/Bimo%20-%20Auditoria%20da%20Estrutura%20da%20Wiki%20Viva%20vs%20LLM%20Wiki%20-%202026-10-26.md): checklist do padrão comparado com a Wiki Viva do app e com esta MemWiki, status e evidência por item, lacunas priorizadas e recomendações não implementadas.

### Interface e aplicativo móvel — planos e especificações

- [Plano do aplicativo móvel — 26/08/2026](documentacao/superpowers/plans/2026-08-26-app-mobile.md).
- [Especificação móvel — 26/08/2026](documentacao/superpowers/specs/2026-08-26-bimo-mobile-design.md).
- [Plano do grafo e bandeja — 31/08/2026](documentacao/superpowers/plans/2026-08-31-grafo-e-bandeja.md).
- [Especificação do grafo e bandeja — 31/08/2026](documentacao/superpowers/specs/2026-08-31-grafo-e-bandeja-design.md).
