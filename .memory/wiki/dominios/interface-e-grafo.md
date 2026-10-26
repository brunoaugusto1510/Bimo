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

## Onde conferir

- [Página principal](../../../src/components/PaginaPrincipal.tsx), [moldura estável](../../../src/components/EspacoDeTrabalho.tsx), [atualizador](../../../src/components/AtualizadorDasNotas.tsx) e [estado das abas](../../../src/lib/espaco-de-trabalho/estado.ts).
- [Autosave](../../../src/lib/edicao/salvamento-automatico.ts), [rascunho local](../../../src/lib/edicao/rascunho-local.ts), [atalhos](../../../src/lib/atalhos.ts) e [rascunho do Bimo](../../../src/lib/rascunho-do-bimo.ts).
- [Grafo de dados](../../../src/lib/grafo-de-notas.ts), [canvas](../../../src/components/GrafoDeFundo.tsx), [rastro](../../../src/lib/rastro-do-agente.ts), [telas da wiki](../../../src/components/wiki/PainelDaWiki.tsx), [tokens](../../../src/app/globals.css) e [guia de design](../../../DESIGN.md).

Relacionadas: [notas](notas-e-autenticacao.md), [agente](agente-e-ingestao.md) e [Wiki Viva](wiki-viva.md).
