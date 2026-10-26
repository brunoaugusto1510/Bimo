# Aplicativo mobile

Verificação local: 26/10/2026. O aplicativo mobile tem árvore, manifesto e testes próprios, separados da aplicação web.

## Estrutura

`mobile/app/` organiza as rotas do Expo Router. O layout raiz monta fontes, tema, gestos e o provedor de serviços. Funcionalidades de notas, editor, chat, grafo, introdução e conta ficam em módulos de `mobile/src/funcionalidades/`.

O estado de funcionalidades usa Zustand. O tema e os componentes compartilhados vivem no aplicativo mobile; não pressupor que tokens ou componentes web podem ser importados diretamente.

## Serviços e limite de integração

Os contratos de leitura/gravação de notas e IA são injetados por um contexto. O provedor padrão usa `servicoVaultFake` e `servicoIaFake`, e o layout raiz o monta sem substituição desses serviços.

Esse é o estado observado do aplicativo: telas e testes com serviços simulados. Não comprova autenticação, persistência no banco web, chamadas de geração reais ou exposição da Wiki Viva no mobile. O vocabulário legado dos nomes de módulos permanece como pista de navegação, sem recomendar sua adoção em novas interfaces.

## Dependências e testes

Consulte o [manifesto mobile](../../../mobile/package.json) para as versões e comandos. Jest usa o preset Expo e configuração própria. O Vitest da raiz exclui o mobile, e o TypeScript web também o exclui; validar apenas o web não valida o aplicativo nativo.

Os planos de interface migrados são históricos. Antes de implementar sua próxima etapa, confira o módulo atual e se o serviço real foi conectado.

Fontes: [layout raiz](../../../mobile/app/_layout.tsx), [provedor de serviços](../../../mobile/src/servicos/ProvedorDeServicos.tsx), [contratos](../../../mobile/src/servicos/contratos.ts), [estado das notas](../../../mobile/src/funcionalidades/vault/estado.ts), [manifesto](../../../mobile/package.json), [plano mobile](../documentacao/superpowers/plans/2026-08-26-app-mobile.md) e [especificação](../documentacao/superpowers/specs/2026-08-26-bimo-mobile-design.md).
