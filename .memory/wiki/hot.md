# Hot Cache

*This file is read first by agents to get immediate context. Agents must update this at the end of every session.*

## Estado atual — 10/11/2026

- **10/11, resumo para LinkedIn:** inventário e texto de publicação preparados a partir do código em `feat/historico-de-conversas`, HEAD `959cbdf`, da documentação e da gravação anterior. O recorte distingue funções implementadas, ingestão no backend, protótipo mobile com serviços simulados e planos de memória pessoal/multiusuário. Estado do deploy atual não verificado. Próximo passo: revisão da publicação pelo usuário.

- **09/11, mídia para LinkedIn:** dois MP4 (18,5 s e 6,6 s) e quatro PNG da interface web em [Bimo - Midia para LinkedIn](C:/Users/bruno/.codex/visualizations/2026/11/09/01a1c087-1ef0-7702-a563-0cbc12729d2a/Bimo%20-%20Midia%20para%20LinkedIn). A passagem **Notas → Bimo** produz a forma de cérebro. A busca **Ctrl+O** mostra título e conteúdo e abre “Atlas das marés”. Captura em cópia local com `NOTAS_FONTE=memoria`, 126 notas e quatro neurônios fictícios; servidor encerrado. Próximo passo: a pessoa pode revisar os arquivos para a publicação.

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

## 11/11/2026 — diagnóstico das credenciais locais

- Pedido: sincronizar credenciais do Vercel para resolver a entrada local; usuário autorizou consultar Supabase também.
- Vercel `bimo` identificado; variáveis sensíveis não retornam valores, inclusive na consulta individual. Nenhuma credencial de produção foi recuperada ou alterada.
- Credenciais existentes no `.env` verificadas por conexão real (`SELECT 1`) e consulta administrativa do usuário configurado: ambas OK. Criado `.env.local` ignorado pelo Git com sete variáveis existentes (banco/runtime/migrações, Supabase, dono, senha e sessão). Segredos não registrados na wiki.
- Servidor já existente em localhost:3000 recarregou `.env.local`; página autenticada ainda mostra erro. Causa confirmada por SELECT sem dados: Postgres 42703, coluna `notas.removida_em` ausente. A mensagem genérica lista DATABASE_URL/USER_ID_PADRAO mesmo em falha de consulta.
- Próximo passo: obter autorização para aplicar `drizzle/0013_lixeira.sql` no banco compartilhado com produção; revisar histórico/índice e aplicar transacionalmente, depois validar a página. Nenhuma migração aplicada nesta sessão. OpenAI/Gemini continuam ausentes no arquivo local original e suas chaves sensíveis não podem ser recuperadas do Vercel.

## 11/11/2026 — migração da lixeira aplicada e local validado

- Usuário autorizou aplicar a 0013 após confirmar que ela habilita exclusão/restauração de notas.
- Pré-verificação: 14 registros Drizzle, último timestamp da 0012; somente 0013 pendente; coluna removida_em ausente e índice antigo sem predicado. Hash atual do arquivo 0012 difere do último hash registrado (divergência preexistente; migração antiga não foi reaplicada nem histórico corrigido).
- Aplicada somente `drizzle/0013_lixeira.sql` pela conexão session pooler, em uma transação com lock_timeout de 5 s, statement_timeout de 30 s e bloqueio do histórico; inserido hash/timestamp calculados pelo leitor de migrações do Drizzle. Histórico agora tem 15 registros.
- Confirmados coluna nullable timestamptz `notas.removida_em` e índice único parcial `WHERE removida_em IS NULL`. Nenhuma nota criada, excluída ou editada; nenhum deploy.
- Validação real da página autenticada em http://localhost:3000: HTTP 200, interface carregada e ausência das mensagens de erro de configuração/carregamento. A pendência da 0013 citada nas entradas históricas acima está resolvida.
- Próximo passo: usuário atualizar a página; teste interativo de mover/restaurar uma nota pode ser feito com nota descartável quando desejado. Chaves locais OpenAI/Gemini continuam fora desta correção.

## 11/11/2026 — cérebro local habilitado

- Usuário reportou ausência de neurônios e mensagem de cérebro não habilitado. `.env.local` não tinha WIKI_VIVA_ATIVA; configurado `WIKI_VIVA_ATIVA=1`.
- Reload do env não bastou: repositório global é cacheado por fonte/dono, não pelas flags. Reiniciado somente o Next local deste checkout para recriar o repositório.
- Verificação autenticada real: GET /api/wiki/cerebro HTTP 200, 58 neurônios e 365 sinapses; GET /api/grafo HTTP 200, 59 nós marcados como neurônio (inclui registro histórico consolidado excluído pelo resumo do cérebro); página principal HTTP 200 sem erro.
- Nenhum dado remoto alterado. Automação não habilitada; OPENAI_API_KEY ausente impede geração/manutenção local. Neurônios existentes estão disponíveis. Próximo passo: atualizar navegador; para geração local, configurar chave OpenAI válida e flags/executor apropriados.

## 11/11/2026 — interface da lixeira refinada

- Tela existente em Lixeira.tsx recebeu busca por título/pasta sem acentos, contagem, cartões com pasta/data, botão de restaurar destacado, carregamento visual, estado vazio, busca vazia e mensagens de erro/sucesso. Texto esclarece preservação do histórico e ausência de descarte automático. Mantido Dialogo com Escape/foco e bloqueio durante restauração.
- Menu da nota destaca Mover para a lixeira em cor de erro e separado das demais ações. Nenhuma mudança no contrato ou exclusão permanente.
- Verificação: 29 testes em quatro arquivos passam (Lixeira, AbaDeNota.lixeira, BarraDeNavegacao, BarraLateral). Nova cobertura funcional da busca e limpar filtro. Página autenticada local HTTP 200 após alteração. Sem excluir notas reais.
- Checagem global tsc encontra referência gerada obsoleta em .next/types/validator.ts à rota [...caminho] e dependência @electric-sql/pglite ausente em três testes da Wiki; nenhum erro reportado nos componentes alterados. Sem revisão visual automatizada nesta sessão.
- Próximo passo: revisar a tela pelo botão Lixeira no rodapé da barra lateral. Código apenas local, sem commit/deploy.

## 11/11/2026 — propostas para editor mínimo de notas

- Usuário invocou Product Design e pediu criação/edição como Obsidian: apenas título e texto livre, limpa e rápida.
- Lidos EditorDeNota, VisaoDaNota, AbaDeNota e tokens de globals.css. Hoje propriedades aparecem entre título/texto e painel lateral ocupa coluna própria.
- Três propostas visuais geradas, na ordem exibida: 1 sidebar de notas com coluna central; 2 foco total com navegação recolhida; 3 trilho compacto com aba e texto mais próximo do topo. Imagens em C:/Users/bruno/.codex/generated_images/01a1cc50-bbb8-7f90-9fab-a7f90940d703/ (exec-698c0056-7a4a-422c-8170-1ca01eff1bdd.png; exec-9c4bb4b4-9322-4e96-afac-89d7552a23e8.png; exec-54218726-4a8d-45aa-a654-61c53266dd45.png).
- Nenhum componente alterado. Fluxo ideate do plugin exige escolha antes de implementação. Próximo passo: receber escolha 1/2/3 e implementar no projeto existente, preservando salvamento, recuperação e atalhos.
- Prévia IAB abriu /login, sem inspeção visual do editor atual. Propostas baseadas no código/tokens; sem screenshot anexado. Preflight Python indisponível; arquivo padrão de contexto do Product Design não existe. Alterações preexistentes preservadas.

## 11/11/2026 — editor mínimo implementado (opção 1)

- Usuário escolheu a primeira proposta e pediu DESIGN.md como base. Criação e edição usam a coluna central de título e texto sem bordas; título azul 26px, corpo 15px desktop/16px mobile, fonte do sistema e tokens existentes. Navegação das notas preservada.
- AbaDeNota deixa de mostrar painel lateral/contagens durante edição. Propriedades editáveis (pasta/tags) passam ao diálogo em Mais opções; Salvar agora também vai ao menu, mantendo Ctrl+S e salvamento automático. Barra permanente do Bimo oculta; comandos por / continuam disponíveis. Recuperação, conflitos e erros mantêm avisos. Leitura preserva propriedades e conexões.
- VisaoDaNota evita extrair tags quando propriedades estão fechadas; AbaDeNota só extrai estrutura em Leitura, reduzindo trabalho durante digitação. Sem alteração no banco ou no contrato de notas.
- Verificação: 130 testes em dez arquivos passaram; após os últimos ajustes, 44 testes relevantes repetidos passam. Lint dos sete arquivos alterados limpo. tsc global segue com problemas preexistentes de referência gerada a rota removida em .next e @electric-sql/pglite ausente em três testes. Há avisos act/NaN de jsdom em testes existentes; nenhum erro no console do navegador observado.
- Revisão autenticada no IAB de edição de notas existentes, menu, propriedades e Escape; temas claro/escuro em 1488×1058 e mobile 390×844. Nenhuma nota real criada/editada/apagada durante revisão. Tema automático e viewport padrão restaurados. design-qa.md registra comparação e resultado passed. Evidências em C:/Users/bruno/.codex/visualizations/2026/11/11/01a1cc50-bbb8-7f90-9fab-a7f90940d703/ (editor-desktop-claro.png, editor-desktop.png, editor-mobile.png, editor-comparacao.png).
- Código apenas local, sem commit/deploy. Alterações anteriores da lixeira, AGENTS e MemWiki preservadas. Próximo passo: usuário revisar a edição local; publicação depende de pedido posterior.

## 11/11/2026 — consolidação das branches iniciada

- Pedido explícito do usuário: reunir todas as pendências na main, incluindo alterações locais da sessão. Origin atualizado por fetch.
- Inventário: main/origin/main em 9a50857; feat/historico-de-conversas em 959cbdf com três commits pendentes (conversas e lixeira). feature/Front tem apenas o merge a2d65f8 ainda não ancestral da main. Simulação git merge-tree com histórico retorna árvore 00e80e85, idêntica à HEAD: integração do merge antigo não altera arquivos.
- Todas as demais refs locais/remotas já são ancestrais da main; não é necessário reaplicar mudanças antigas. Sem stashes. Um único worktree Git registrado; diretório .claude/worktrees/login-multiusuario é ponteiro histórico sem checkout Git independente, não uma branch pendente.
- Próximo passo: registrar alterações locais do editor/lixeira/wiki/AGENTS, integrar histórico e Front preservando commits, verificar testes offline/tipagem/lint. Nenhum push ou deploy solicitado.

## 11/11/2026 — consolidação concluída na main local

- Todas as branches locais e origin estão contidas na main; `git branch --no-merged main` e `git branch -r --no-merged main` retornam vazio. Main anterior preservada em codex/backup-main-2026-11-11 (9a50857).
- Alterações locais de editor, lixeira, documentação e AGENTS registradas no commit da7f15c. Main avançou por fast-forward sobre feat/historico-de-conversas, incluindo 4ecec9c, 6d108f5 e 959cbdf. Merge 38d03f7 integrou feature/Front/a2d65f8 sem conflitos nem mudanças adicionais de árvore. Nenhuma branch removida e nenhum histórico reescrito.
- `npm install --ignore-scripts --no-audit --no-fund` restaurou duas dependências faltantes sem modificar os manifests; `next typegen` corrigiu a referência gerada obsoleta. ESLint src/scripts e tsc passaram sem erros.
- Suíte offline: 184 arquivos, 2.195 testes; 2.194 passaram na rodada completa. Única falha era a expectativa antiga de contador/botão visíveis durante Edição em AbaDeNota.revalidacao.test.tsx. Atualizada para conferir ligações em Leitura, ocultação durante Edição, checkpoint pelo menu e preservação ao voltar à Leitura. Reexecução do arquivo: 2/2 passam; lint do arquivo limpo. Nenhuma falha pendente conhecida nesta verificação. Avisos de act/NaN de jsdom ainda aparecem em algumas suítes.
- Excluídos os quatro arquivos que acessam banco real: repositorio-de-notas/banco.test.ts, conversas/banco.test.ts, wiki/banco.test.ts e tests/busca-textual.integration.test.ts. PGlite rodou apenas em memória. Nenhuma migração, acesso de teste ao Supabase real ou chamada de modelo real.
- Sem push/deploy: origin/main continua em 9a50857. Próximo passo, se solicitado: publicar a main local. O registro acima é histórico; o commit final de teste/documentação vem após 38d03f7.
