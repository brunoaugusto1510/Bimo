# Hot Cache

*This file is read first by agents to get immediate context. Agents must update this at the end of every session.*

## Estado atual — 26/10/2026

- **Atualização das 17h37 (auditoria somente de leitura):** o checkout está em `fix/revisao-geral-wiki-viva`, HEAD `e90ee94`, sincronizado com o origin.
  - Telas da Wiki Viva: commits `d1677a9` e `57754ae`.
  - Registro na MemWiki: `e90ee94`.
  - Correções da revisão geral: `87b6da8`; relatório: `623f121`.
  - Não verificados: se há PR aberto e o estado de produção.
  - As linhas abaixo que citam `main`/`99e0cc8` e "nada commitado" são anteriores a esses commits.
- A [auditoria da estrutura vs LLM Wiki](documentacao/Bimo%20-%20Auditoria%20da%20Estrutura%20da%20Wiki%20Viva%20vs%20LLM%20Wiki%20-%202026-10-26.md) compara a Wiki Viva do app e esta MemWiki com o padrão:
  - Estrutura correta no essencial nas duas camadas; nenhum item CRITICAL.
  - Um HIGH no app: uma nota criada pelo agente do chat (`criar_nota`) pode virar raiz de neurônio sem marca de autoria.
  - Na MemWiki, hot, bugs, decisions e log não acompanharam a [revisão geral](documentacao/Bimo%20-%20Revisao%20Geral%20da%20Wiki%20Viva%20-%202026-10-26.md).
- **Antes de mexer na migração 0011**, leia a seção 3c da auditoria. O Plano de Notas no Banco diz que a 0011 está aplicada em produção desde 23/10, mas a revisão geral descreve uma ordem de deploy como se ela estivesse pendente. O estado real não foi verificado.

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

- Revisar e commitar as telas da Wiki Viva junto das alterações de backend que já estavam pendentes no checkout. *(Commit feito em 26/10: `d1677a9`, `57754ae`, `e90ee94`, branch no origin. Falta a revisão humana e decidir o PR.)*
- Decidir o tratamento do HIGH da auditoria (autoria das fontes: nota escrita pelo chat como raiz de neurônio) antes de ampliar o processamento do acervo.
- Propagar a revisão geral para a MemWiki: decisões do usuário em `decisions.md`, achados abertos em `bugs.md`, resumo em `dominios/wiki-viva.md` e uma entrada no Plano de Notas no Banco.
- Resolver a contradição sobre a 0011 registrando a que ambiente vale a nota de deploy; conferir o histórico do Drizzle em produção só com autorização.
- As demais lacunas (MEDIUM e LOW) e recomendações estão nas seções 4 e 5 da auditoria; nenhuma foi implementada.

- Para continuar uma funcionalidade, leia o documento correspondente no índice e confira o código atual antes de reutilizar afirmações históricas.
- Alinhar a descrição operacional dos limites do chat após conferir os valores aprovados no agente e na rota; preservar relatórios históricos.
- Registre novos aprendizados nas páginas de domínio e mantenha `index.md`, `hot.md` e `log.md` atualizados. Diferencie leitura de código, teste local e evidência de produção.
