# Hot Cache

*This file is read first by agents to get immediate context. Agents must update this at the end of every session.*

## Estado atual — 26/10/2026

- **30/10, lixeira com restauração implementada localmente:** usuário escolheu lixeira após o diagnóstico da falta de exclusão. Menu da nota confirma e salva pendências antes de mover; rodapé da barra lateral abre a lixeira com restauração. Preserva ID, conteúdo e histórico; colisão de título recusa restauração sem sobrescrever. Wiki deixa de ler fontes na lixeira e invalida posses em voo. Checkout observado: `feat/historico-de-conversas`, HEAD `6d108f5`, alterações anteriores preservadas. **Migração `0013_lixeira.sql` testada somente em PGlite, não aplicada ao banco real: aplicar antes de executar/publicar este código com banco.** Tipos/lint e testes focados passam; [evidências e resultado da regressão](verificacoes/2026-10-30-lixeira.md). Sem commit/deploy. Próximo passo: revisar o diff e aplicar/testar a migração no ambiente persistente quando solicitado.

- **30/10, novo chat e histórico no chat (local, sem commit):** botões "Histórico" e "Novo chat" + conversas guardadas no banco (`conversas`/`mensagens_de_conversa`, rotas `/api/conversas`, módulo `src/lib/conversas/`). **A migração `drizzle/0012_conversas.sql` foi aplicada no banco real em 30/10** (ordem do índice único corrigida antes; só a 0012 rodou) e `conversas/banco.test.ts` passa 11/11 contra ele, sem sobras de teste. tsc/eslint limpos; dois testes de `repositorio-de-notas/banco.test.ts` estouraram o prazo de 5 s (banco real, módulo intocado). Atenção: o histórico em produção só funciona depois do deploy deste código. Próximo passo: revisar/commitar e publicar. Ver [log](log.md) e [interface](dominios/interface-e-grafo.md).

- **30/10, manutenção autorizada após a revisão:** seis temas de blockchain/economia enriquecidos no **banco real**; 4873 preservado como registro histórico que aponta a 4872, protegido/pausado. **30 afirmações, 50 citações válidas, dez notas do recorte intactas**, sete novas versões/eventos e histórico preservado. Prevenção de duplicatas por sufixo/título atual e melhoria do prompt implementadas **somente localmente**; **314 testes em 28 arquivos**, tipos/lint limpos, com oito testes de observabilidade repetidos após o ajuste final. [Entrega e limites](verificacoes/2026-10-30-consolidacao-blockchain-economia.md). Sem commit/push/deploy. Próximo passo: revisar/publicar o código quando autorizado; produção ainda pode mostrar o redirecionamento como registro pausado e usa o gerador anterior.

- **30/10, revisão real dos neurônios de blockchain/economia:** conformidade parcial com LLM Wiki. Sete neurônios (4869–4875), 23 afirmações, 25 citações conferidas nas oito notas de origem. Duplicata confirmada de mercados (4872/4873), sem alerta no diagnóstico persistido; falta maior síntese das relações e contexto temporal. [Avaliação completa](verificacoes/2026-10-30-neuronios-blockchain-economia.md). Só SELECT no Supabase e registro documental; nenhum neurônio, código ou dado remoto alterado. Próximo passo, se solicitado: corrigir prevenção de duplicatas e propor consolidação preservando histórico/referências; não executar fusão automaticamente.

- **29/10, 10h46: busca do chat por assuntos implementada localmente** sobre `main`, HEAD `9a50857`. `buscar_notas` aceita até quatro consultas adicionais; amplia buscas simples sem resultados em até quatro termos úteis; mantém consultas específicas e sintaxe explícita; deduplica/intercala resultados. Entrega índice de até 20 neurônios também por aliases, mesmo com zero notas; recibo mostra o índice. Prompt orienta índice → neurônios → origens. **137 testes offline em 8 arquivos, tipos e lint limpos**, cobertura do novo módulo 100%. Sem banco/modelo real, migração, commit, push ou deploy. Próximo passo: revisar o diff e validar o comportamento com modelo/acervo real quando autorizado. [Evidência](verificacoes/2026-10-29-busca-do-chat.tdd.md). Os diagnósticos abaixo precedem esta implementação.

- **27/10: modos de consolidação e energia decididos (nada implementado).** Padrão contínuo; o lint divide o orçamento diário com chat e ingestão; autonomia é configuração da pessoa ("publicar direto" por padrão, "propor antes de publicar" opcional, que exige fila e tela de aprovação ainda inexistentes). Em aberto: prioridade dentro do orçamento, critérios do lint, orçamento padrão. Ver [modos de consolidação e energia](documentacao/Bimo%20-%20Modos%20de%20Consolidacao%20e%20Energia.md) e [decisões](decisions.md).

- **27/10: plano completo da memória do aplicativo, com ECC.** [Plano do sistema de memória](documentacao/Bimo%20-%20Plano%20do%20Sistema%20de%20Memoria.md), revisão 1, proposto sobre `feat/wiki-viva-em-rede`, HEAD `e5d6394`.
  - Recomenda manter Responses API com armazenamento de conversas/memórias no banco do Bimo; aproveitar notas e Wiki Viva `rede-v5` como conhecimento existente.
  - Define contratos, dados, turnos idempotentes e recuperação, contexto limitado, extração/consolidação, correção/expiração/esquecimento, retenção e custo, além de fases F0–F8 e AC-001–030.
  - Primeira fatia utilizável: histórico persistente e memória explícita; depois recuperação personalizada, captura seletiva e compactação opcional.
  - Revisar D-01–D-08, especialmente retenção/backups, captura automática, dados sensíveis, dono único e orçamento antes das respectivas ativações. São propostas, não decisões aceitas.
  - Só documentação/MemWiki; sem código, migração, teste de software, chamada de modelo, banco remoto, commit ou push. O ponteiro do worktree de login preexistente fica fora.

- **27/10: desenho da tensão entre neurônios (lacuna 8), estacionado pelo usuário** ("vejo isso depois"; há prioridades maiores). Não implementar sem novo pedido. Em [documentacao/Bimo - Desenho da Tensao entre Neuronios.md](documentacao/Bimo%20-%20Desenho%20da%20Tensao%20entre%20Neuronios.md). Nenhum código escrito. As quatro decisões pedidas ao usuário estão na entrada "desenho" do log de 27/10.

- **27/10: primeira fonte de `.raw/` ingerida.** `.memory/.raw/llm-wiki.md` é o texto do padrão LLM Wiki, resumido em [fonte: LLM Wiki](fontes/llm-wiki-karpathy.md).
  - A referência de 23/10 e a auditoria de 26/10 conferem com a fonte; nada foi contradito.
  - Pontos novos (F1–F6): discutir a fonte com a pessoa antes de escrever, página de resumo por fonte, lint que sugere perguntas e fontes, índice suficiente até cerca de 100 fontes, frontmatter.
  - `.raw/` continua fora do git. Versionar e transformar o fluxo por fonte em regra do `AGENTS.md` dependem do usuário.
  - Só MemWiki mudou; nenhum código.

- **Atualização das 20h25: Wiki Viva em rede (política `rede-v5`).** Branch `feat/wiki-viva-em-rede`, criada a partir da `main` em `80be741`. *(Commitada em 27/10, sem push e sem PR; o ponteiro `.claude/worktrees/login-multiusuario` ficou fora.)*
  - O usuário aceitou o HIGH da auditoria: nota salva pelo chat pode virar raiz de neurônio.
  - Pediu as recomendações sem conservadorismo, perto do LLM Wiki do Karpathy. O que entrou:
    - até 6 propostas por resposta e resumo de uma linha por neurônio;
    - ligações `proposta:N` recíprocas e teto de 16 ligações;
    - índice com resumo (250 entradas), 8 candidatas e vizinhos na recuperação;
    - consulta do chat com `relacionados` e a ferramenta `indice_da_wiki`;
    - alerta `isolado` com uma releitura da origem;
    - saída do modelo de 12.288 tokens na descoberta.
  - Detalhes em [decisões](decisions.md) e no [domínio Wiki Viva](dominios/wiki-viva.md).
  - **Verificado:** `tsc` e `eslint src scripts` limpos; 2.100 testes offline em 174 arquivos, sem as duas suítes de banco real.
  - **Não verificado:** comportamento com o modelo real; custo por chamada com seis propostas; produção.
  - Uma execução anterior desta sessão incluiu `src/lib/tests` inteiro, o que pode ter rodado `busca-textual.integration.test.ts` contra o Supabase real. Essa suíte usa usuários efêmeros e nunca o dono real.

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

- **30/10, 17h18 — diagnóstico inicial da exclusão:** a interface estava sem ação de apagar, o contrato sem exclusão e a rota individual apenas com GET/PATCH. Na sequência, o usuário escolheu lixeira restaurável; a implementação local e a migração pendente estão registradas acima e em [notas](dominios/notas-e-autenticacao.md).

- **29/10, exemplo blockchain/tokenização:** print mostra busca composta vazia e leitura de duas notas pessoais, sem passo de índice; payload interno da Wiki desconhecido. Comparação com a fonte LLM Wiki: recomendação de consultar índice → neurônios relevantes → origens conforme necessidade. Busca composta usa AND no banco e no repositório em memória; possível causa do zero, sem reprodução com acervo real. Nenhuma implementação aprovada ou realizada.

- **29/10, diagnóstico local do chat:** checkout `main`, HEAD `9a50857`. `buscar_notas` acrescenta até quatro neurônios (síntese limitada a 4.000 caracteres quando atualizada) e seis vizinhos por caminho/resumo; `indice_da_wiki` mostra o mapa e `ler_nota` abre o texto completo. O laço não impõe consulta à Wiki antes de responder. O recibo de busca mostra apenas a contagem das notas, podendo ocultar que o modelo recebeu contexto da Wiki. Comportamento de uma conversa real e produção não verificados; ver [agente e ingestão](dominios/agente-e-ingestao.md).

- Revisar o [plano de memória do aplicativo](documentacao/Bimo%20-%20Plano%20do%20Sistema%20de%20Memoria.md), decidir as políticas da seção 17 e, quando solicitado, iniciar F0/F1. Planejamento não autoriza ativação nem substitui a integração futura de contas para memórias privadas por pessoa.

- Revisar e commitar a branch `feat/wiki-viva-em-rede` (sem o ponteiro `.claude/worktrees/login-multiusuario`, que aparece modificado e não faz parte da mudança). *(Commit feito em 27/10; falta decidir push e PR.)*
- Antes de ligar a política `rede-v5` em produção:
  - rodar algumas notas reais e medir o consumo por chamada (seis propostas e 12.288 tokens de saída);
  - conferir a qualidade das ligações e dos panoramas;
  - acompanhar a proporção de neurônios isolados.
- Lacunas da auditoria que seguem abertas:
  - 7: remoções sem evento no Diário;
  - 9: chave congelada após renomear e paráfrases;
  - 8: contradição entre neurônios;
  - toda a camada B (hot/log/bugs).

- Revisar e commitar as telas da Wiki Viva junto das alterações de backend que já estavam pendentes no checkout. *(Commit feito em 26/10: `d1677a9`, `57754ae`, `e90ee94`, branch no origin. Falta a revisão humana e decidir o PR.)*
- Decidir o tratamento do HIGH da auditoria (autoria das fontes: nota escrita pelo chat como raiz de neurônio) antes de ampliar o processamento do acervo.
- Propagar a revisão geral para a MemWiki: decisões do usuário em `decisions.md`, achados abertos em `bugs.md`, resumo em `dominios/wiki-viva.md` e uma entrada no Plano de Notas no Banco.
- Resolver a contradição sobre a 0011 registrando a que ambiente vale a nota de deploy; conferir o histórico do Drizzle em produção só com autorização.
- As demais lacunas (MEDIUM e LOW) e recomendações estão nas seções 4 e 5 da auditoria; nenhuma foi implementada.

- Para continuar uma funcionalidade, leia o documento correspondente no índice e confira o código atual antes de reutilizar afirmações históricas.
- Alinhar a descrição operacional dos limites do chat após conferir os valores aprovados no agente e na rota; preservar relatórios históricos.
- Registre novos aprendizados nas páginas de domínio e mantenha `index.md`, `hot.md` e `log.md` atualizados. Diferencie leitura de código, teste local e evidência de produção.
