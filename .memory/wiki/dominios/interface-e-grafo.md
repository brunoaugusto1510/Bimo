# Espaço de trabalho, editor e grafo

Verificação local: 26/10/2026. Esta síntese registra arquitetura e convenções; não substitui avaliação visual nem testes de interação.

## Estado e navegação

`PaginaPrincipal` reúne o estado interativo. `EspacoDeTrabalho` mantém uma árvore estável e usa sobreposições para notas e telas, preservando as instâncias de chat e grafo ao trocar de modo. Remontá-las perderia conversa e estado da simulação.

Abas, histórico de navegação, notas locais recém-criadas e dados recebidos do servidor têm ciclos próprios. O atualizador busca árvore e grafo e combina os dados existentes; uma atualização não deve descartar uma nota nova antes de uma listagem posterior à sua criação.

## Edição

O editor integra título, pasta, tags, ligações e rascunhos. A fila de autosave recebe a revisão-base, preserva texto local em erro/conflito e serializa operações exclusivas. Dados de armazenamento local são validados como entrada externa.

Sugestões de rascunho são texto proposto; a pessoa decide incorporá-las. Gerar um rascunho não equivale a gravar a nota. Os atalhos passam pela função de combinação de teclas existente, inclusive para distinguir teclas mortas.

## Grafo e design

O grafo deriva nós e arestas das notas e dos wikilinks. Metadados distinguem neurônios e relações com raízes, mas não criam um segundo armazenamento de arestas. A simulação e a câmera ficam desacopladas dos eventos do chat; o rastro representa leituras, buscas e escritas.

`globals.css` define os tokens semânticos de cor e tema. O canvas relê cores quando o tema muda. A interface usa o design existente, incluindo cor de ação, estados, legibilidade e movimento reduzido.

Cérebro, Diário e neurônio aberto usam contratos de leitura e gerenciamento da Wiki Viva. Métricas de cobertura ou energia não devem ser apresentadas como prova de correção do conhecimento.

## Telas da Wiki Viva e o desenho — 26/10/2026

A fonte do desenho é o artifact "Bimo — Wiki Viva: conceitos e telas" (https://claude.ai/artifact/Jr5HEw8UqmRFsVJDQBEVFy): pranchetas `Cerebro`, `Neuronio`, `Diario`, `Estados` e as variantes `*Escuro` e `*Celular`. As telas foram reescritas para segui-lo e conferidas no navegador com dados reais (claro, escuro e 375 px), sem avaliação em produção.

- **Cérebro** (`wiki/CerebroDaWiki.tsx`): sobreposição no grafo inteiro, não um painel lateral. No alto, legenda (some no celular) e chips "Tudo / Só neurônios / Nascidos esta semana · N / Precisam de você · N"; embaixo, a pílula da fila ("N notas na fila para consolidar", estática: a fila não diz se há rodada em andamento, e `BimoPensando` é só para o Bimo pensando agora) e o cartão do neurônio escolhido, que vira folha presa à base no celular. Escolher um neurônio no grafo abre o cartão; "Abrir neurônio" leva ao detalhe. As origens do cartão vêm das arestas `sinapse` do grafo.
- **Filtros**: `filtro-do-cerebro.ts` calcula os ids; `GrafoDeFundo` recebe `somenteNeuronios` e `neuroniosVisiveis`, e a câmera enquadra o que sobra. O enquadramento depende do conteúdo do filtro, não da identidade do `Set` (a consulta de 30 s recria o Set).
- **Diário** (`wiki/DiarioDaWiki.tsx`): manchete na voz do Bimo calculada dos eventos, cartões por tipo (nascimento em azul-suave), leituras sem novidade agrupadas num `<details>`, resumo (despertar, neurônios, sinapses, energia) à direita só a partir de `lg`, porque a barra lateral estreita a área em `md`. Evento sem neurônio e com `origemId` oferece "Abrir nota".
- **Neurônio aberto** (`wiki/NeuronioAberto.tsx`): barra "← pasta / título ✕" própria, citações como sobrescritos pequenos com área de toque ampliada, sinapses numeradas pela fonte, interruptor "O Bimo cuida deste neurônio" (desligar envia `gerenciada: false`) e, se protegido, "Devolver ao Bimo". No celular (abaixo de `md`) a citação abre uma folha "Sinapse i de n".
- **Grafo** (`desenhar-neuronio.ts`): halo, anel e miolo por estado; rótulos permanentes dos neurônios só em canvas com 768 px ou mais.
- **Seleção e filtro**: `PaginaPrincipal` deriva `selecaoVisivel`; um neurônio escolhido que o filtro esconde perde o cartão e o foco do grafo, e volta a valer em "Tudo". A câmera reenquadra pela chave do filtro escolhido (`chaveDoFiltro`), não pelo conteúdo do recorte. "Ver origens" só aparece em "Tudo". Com o cérebro aberto a página consulta o resumo mesmo sem neurônio no grafo, para descobrir o primeiro.
- O modo `comPainelWiki` do `GrafoDeFundo` (canvas encolhido para um painel lateral) foi removido junto com o painel.

Desvios conscientes: o diário não oferece "Deixar como está/Devolver ao Bimo" direto no cartão, porque o evento não traz a revisão; o cartão leva ao neurônio. As bolinhas de pasta nas sinapses ficaram fora, porque a cor da pasta depende do mapa de grupos do grafo.

## Onde conferir

- [Página principal](../../../src/components/PaginaPrincipal.tsx), [moldura estável](../../../src/components/EspacoDeTrabalho.tsx), [atualizador](../../../src/components/AtualizadorDasNotas.tsx) e [estado das abas](../../../src/lib/espaco-de-trabalho/estado.ts).
- [Autosave](../../../src/lib/edicao/salvamento-automatico.ts), [rascunho local](../../../src/lib/edicao/rascunho-local.ts), [atalhos](../../../src/lib/atalhos.ts) e [rascunho do Bimo](../../../src/lib/rascunho-do-bimo.ts).
- [Grafo de dados](../../../src/lib/grafo-de-notas.ts), [canvas](../../../src/components/GrafoDeFundo.tsx), [rastro](../../../src/lib/rastro-do-agente.ts), [telas da wiki](../../../src/components/wiki/PainelDaWiki.tsx), [tokens](../../../src/app/globals.css) e [guia de design](../../../DESIGN.md).

Relacionadas: [notas](notas-e-autenticacao.md), [agente](agente-e-ingestao.md) e [Wiki Viva](wiki-viva.md).

## Novo chat e histórico (30/10/2026)

- O alto do [chat](../../src/components/Chat.tsx) tem "Histórico" e "Novo chat" ([HistoricoDeConversas](../../src/components/HistoricoDeConversas.tsx)), só quando o `Chat` recebe a prop `conversas`; `PaginaPrincipal` passa o cliente real. O `Chat` continua uma árvore estável: novo chat/abrir só trocam o estado interno.
- "Novo chat" fica desabilitado com a conversa vazia ou enquanto o Bimo responde; abrir conversa também espera a resposta terminar.
- Gravações em fila única (ordem das mensagens); o id da conversa nasce no cliente. Detalhes de dados e rotas em [agente e ingestão](agente-e-ingestao.md) e no [log](../log.md); migração `0012_conversas` precisa ser aplicada antes de o histórico funcionar com `NOTAS_FONTE=banco`.

## 11/11/2026 — interface da lixeira refinada

- Tela existente em Lixeira.tsx recebeu busca por título/pasta sem acentos, contagem, cartões com pasta/data, botão de restaurar destacado, carregamento visual, estado vazio, busca vazia e mensagens de erro/sucesso. Texto esclarece preservação do histórico e ausência de descarte automático. Mantido Dialogo com Escape/foco e bloqueio durante restauração.
- Menu da nota destaca Mover para a lixeira em cor de erro e separado das demais ações. Nenhuma mudança no contrato ou exclusão permanente.
- Verificação: 29 testes em quatro arquivos passam (Lixeira, AbaDeNota.lixeira, BarraDeNavegacao, BarraLateral). Nova cobertura funcional da busca e limpar filtro. Página autenticada local HTTP 200 após alteração. Sem excluir notas reais.
- Checagem global tsc encontra referência gerada obsoleta em .next/types/validator.ts à rota [...caminho] e dependência @electric-sql/pglite ausente em três testes da Wiki; nenhum erro reportado nos componentes alterados. Sem revisão visual automatizada nesta sessão.
- Próximo passo: revisar a tela pelo botão Lixeira no rodapé da barra lateral. Código apenas local, sem commit/deploy.

## 11/11/2026 — editor mínimo implementado (opção 1)

- Usuário escolheu a primeira proposta e pediu DESIGN.md como base. Criação e edição usam a coluna central de título e texto sem bordas; título azul 26px, corpo 15px desktop/16px mobile, fonte do sistema e tokens existentes. Navegação das notas preservada.
- AbaDeNota deixa de mostrar painel lateral/contagens durante edição. Propriedades editáveis (pasta/tags) passam ao diálogo em Mais opções; Salvar agora também vai ao menu, mantendo Ctrl+S e salvamento automático. Barra permanente do Bimo oculta; comandos por / continuam disponíveis. Recuperação, conflitos e erros mantêm avisos. Leitura preserva propriedades e conexões.
- VisaoDaNota evita extrair tags quando propriedades estão fechadas; AbaDeNota só extrai estrutura em Leitura, reduzindo trabalho durante digitação. Sem alteração no banco ou no contrato de notas.
- Verificação: 130 testes em dez arquivos passaram; após os últimos ajustes, 44 testes relevantes repetidos passam. Lint dos sete arquivos alterados limpo. tsc global segue com problemas preexistentes de referência gerada a rota removida em .next e @electric-sql/pglite ausente em três testes. Há avisos act/NaN de jsdom em testes existentes; nenhum erro no console do navegador observado.
- Revisão autenticada no IAB de edição de notas existentes, menu, propriedades e Escape; temas claro/escuro em 1488×1058 e mobile 390×844. Nenhuma nota real criada/editada/apagada durante revisão. Tema automático e viewport padrão restaurados. design-qa.md registra comparação e resultado passed. Evidências em C:/Users/bruno/.codex/visualizations/2026/11/11/01a1cc50-bbb8-7f90-9fab-a7f90940d703/ (editor-desktop-claro.png, editor-desktop.png, editor-mobile.png, editor-comparacao.png).
- Código apenas local, sem commit/deploy. Alterações anteriores da lixeira, AGENTS e MemWiki preservadas. Próximo passo: usuário revisar a edição local; publicação depende de pedido posterior.
