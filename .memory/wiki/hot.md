# Hot Cache

*This file is read first by agents to get immediate context. Agents must update this at the end of every session.*

## Estado atual — 26/10/2026

- MemWiki inicializada e ingestão do repositório realizada. Os 25 documentos anteriormente em `docs/` estão preservados em `documentacao/`; stack, padrões, decisões e problemas agora têm conteúdo sintetizado.
- Comece pelo [índice](index.md). As páginas de domínio cobrem [notas/autenticação](dominios/notas-e-autenticacao.md), [agente/ingestão](dominios/agente-e-ingestao.md), [Wiki Viva](dominios/wiki-viva.md), [interface/grafo](dominios/interface-e-grafo.md) e [mobile](dominios/mobile.md).
- Base observada: `main`, commit `99e0cc8`, com alterações locais em andamento. As leituras descrevem a árvore de trabalho; não consideram essas alterações uma entrega validada ou publicada.
- Para a Wiki Viva do aplicativo, consulte a [entrega consolidada de 26/10](documentacao/Bimo%20-%20Entrega%20Consolidada%20da%20Wiki%20Viva%20-%202026-10-26.md), a [operação](documentacao/Bimo%20-%20Wiki%20Viva%20-%20Operacao.md) e as [pendências](documentacao/Bimo%20-%20Wiki%20Viva%20-%20Pendencias.md). Esses documentos registram política editorial `sintetica-v4`, processamento em lotes e ensaios reais. A migração documental não repetiu a verificação de produção.
- A [referência sobre LLM Wiki e Obsidian](documentacao/Bimo%20-%20LLM%20Wiki%20-%20Funcionamento%20e%20Referencias%20Obsidian.md) retrata o levantamento de 23/10; suas observações sobre ativação e limites devem ser lidas nessa data, junto dos registros posteriores.
- MemWiki é a memória dos agentes no repositório. A Wiki Viva é uma funcionalidade do Bimo sobre as notas da pessoa; mantenha essa distinção nas próximas tarefas.
- Atenção documental: o README descreve limites do chat diferentes dos observados em `src/lib/agente.ts`. Confira [problemas](bugs.md) e o [relatório de ingestão/lint](verificacoes/2026-10-26-ingest-lint.md) antes de reutilizar esses números.
- O mobile usa serviços simulados por padrão. A ingestão não verificou produção, execução de modelos, ambiente nativo ou resultados de testes do aplicativo.

- Telas da Wiki Viva reescritas em 26/10 para seguir o artifact de design: cérebro em sobreposição com chips e cartão, diário "Enquanto você estava fora", neurônio aberto com sinapses e folha no celular, glifos de estado no grafo. Detalhes em [interface e grafo](dominios/interface-e-grafo.md). Testes, tipos e lint passam; nada commitado.

## Próximos passos

- Revisar e commitar as telas da Wiki Viva junto das alterações de backend que já estavam pendentes no checkout.

- Para continuar uma funcionalidade, leia o documento correspondente no índice e confira o código atual antes de reutilizar afirmações históricas.
- Alinhar a descrição operacional dos limites do chat após conferir os valores aprovados no agente e na rota; preservar relatórios históricos.
- Registre novos aprendizados nas páginas de domínio e mantenha `index.md`, `hot.md` e `log.md` atualizados. Diferencie leitura de código, teste local e evidência de produção.
